package main

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	_ "modernc.org/sqlite"
)

type Database struct {
	*sql.DB
}

func InitDB() (*Database, error) {
	exePath, err := os.Executable()
	if err != nil {
		return nil, err
	}
	dbPath := filepath.Join(filepath.Dir(exePath), "manga_tracker.db")

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, err
	}

	queries := []string{
		`PRAGMA foreign_keys = ON;`,
		`PRAGMA journal_mode = WAL;`,
		`PRAGMA busy_timeout = 5000;`,
		`CREATE TABLE IF NOT EXISTS manga (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			title TEXT,
			normalized_slug TEXT,
			source TEXT,
			main_url TEXT,
			cover_path TEXT,
			status TEXT DEFAULT 'Reading',
			last_read_chapter TEXT,
			last_read_at DATETIME,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(source, normalized_slug)
		);`,
		`CREATE TABLE IF NOT EXISTS reading_history (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			manga_id INTEGER,
			chapter_number TEXT,
			chapter_sort_key TEXT,
			chapter_title TEXT,
			chapter_url TEXT,
			read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY(manga_id) REFERENCES manga(id) ON DELETE CASCADE
		);`,
		`CREATE INDEX IF NOT EXISTS idx_manga_last_read ON manga(last_read_at DESC);`,
		`CREATE INDEX IF NOT EXISTS idx_history_manga_read ON reading_history(manga_id, read_at DESC);`,
	}

	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			return nil, fmt.Errorf("failed executing query %q: %w", q, err)
		}
	}

	alterQueries := []string{
		`ALTER TABLE manga ADD COLUMN last_chapter_url TEXT DEFAULT '';`,
		`ALTER TABLE manga ADD COLUMN is_pinned INTEGER DEFAULT 0;`,
	}
	for _, q := range alterQueries {
		db.Exec(q) // Ignore errors if columns already exist
	}

	return &Database{db}, nil
}

type TrackRequest struct {
	Title         string `json:"title"`
	Slug          string `json:"slug"`
	Source        string `json:"source"`
	MainUrl       string `json:"mainUrl"`
	ChapterNumber string `json:"chapterNumber"`
	ChapterTitle  string `json:"chapterTitle"`
	ChapterUrl    string `json:"chapterUrl"`
	CoverBase64   string `json:"coverBase64"` // From extension
	SortKey       string `json:"sortKey"`
}

func (db *Database) UpsertMangaAndChapter(req TrackRequest, coverPath string) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Normalize slug
	normalizedSlug := strings.ToLower(strings.TrimSpace(req.Slug))
	source := strings.ToLower(strings.TrimSpace(req.Source))

	// Upsert Manga
	_, err = tx.Exec(`
		INSERT INTO manga (title, normalized_slug, source, main_url, cover_path, last_read_chapter, last_chapter_url, last_read_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		ON CONFLICT(source, normalized_slug) DO UPDATE SET
			title = excluded.title,
			main_url = CASE WHEN excluded.main_url != '' THEN excluded.main_url ELSE main_url END,
			cover_path = CASE WHEN excluded.cover_path != '' THEN excluded.cover_path ELSE cover_path END,
			last_read_chapter = excluded.last_read_chapter,
			last_chapter_url = excluded.last_chapter_url,
			last_read_at = CURRENT_TIMESTAMP,
			updated_at = CURRENT_TIMESTAMP
	`, req.Title, normalizedSlug, source, req.MainUrl, coverPath, req.ChapterNumber, req.ChapterUrl)

	if err != nil {
		return fmt.Errorf("manga upsert error: %w", err)
	}

	var mangaID int
	err = tx.QueryRow(`SELECT id FROM manga WHERE source = ? AND normalized_slug = ?`, source, normalizedSlug).Scan(&mangaID)
	if err != nil {
		return fmt.Errorf("failed to get manga id: %w", err)
	}

	// Insert Reading History (rereads are allowed)
	_, err = tx.Exec(`
		INSERT INTO reading_history (manga_id, chapter_number, chapter_sort_key, chapter_title, chapter_url, read_at)
		VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
	`, mangaID, req.ChapterNumber, req.SortKey, req.ChapterTitle, req.ChapterUrl)
	if err != nil {
		return fmt.Errorf("history insert error: %w", err)
	}

	return tx.Commit()
}

type Manga struct {
	ID              int    `json:"id"`
	Title           string `json:"title"`
	Slug            string `json:"slug"`
	Source          string `json:"source"`
	MainUrl         string `json:"mainUrl"`
	CoverPath       string `json:"coverPath"`
	Status          string `json:"status"`
	LastReadChapter string `json:"lastReadChapter"`
	LastChapterUrl  string `json:"lastChapterUrl"`
	IsPinned        bool   `json:"isPinned"`
	LastReadAt      string `json:"lastReadAt"`
}

func (db *Database) GetAllManga() ([]Manga, error) {
	rows, err := db.Query(`SELECT id, title, normalized_slug, source, main_url, cover_path, status, last_read_chapter, COALESCE(last_chapter_url, ''), COALESCE(is_pinned, 0), last_read_at FROM manga ORDER BY COALESCE(is_pinned, 0) DESC, last_read_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var res []Manga
	for rows.Next() {
		var m Manga
		var isPinned int
		if err := rows.Scan(&m.ID, &m.Title, &m.Slug, &m.Source, &m.MainUrl, &m.CoverPath, &m.Status, &m.LastReadChapter, &m.LastChapterUrl, &isPinned, &m.LastReadAt); err != nil {
			return nil, err
		}
		m.IsPinned = isPinned == 1
		// ensure valid cover url
		if m.CoverPath != "" {
			m.CoverPath = "/api/covers/" + filepath.Base(m.CoverPath)
		}
		res = append(res, m)
	}
	return res, nil
}

func (db *Database) TogglePinManga(id int) error {
	_, err := db.Exec(`UPDATE manga SET is_pinned = CASE WHEN COALESCE(is_pinned, 0) = 1 THEN 0 ELSE 1 END WHERE id = ?`, id)
	return err
}

func (db *Database) DeleteManga(id int) error {
	_, err := db.Exec(`DELETE FROM manga WHERE id = ?`, id)
	return err
}
