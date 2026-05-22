package main

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

func handleTrack(db *Database, w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req TrackRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}

	if req.Source == "" || req.Slug == "" {
		http.Error(w, "Source and Slug are required", http.StatusBadRequest)
		return
	}

	coverPath := ""
	if req.CoverBase64 != "" {
		hash := sha256.Sum256([]byte(req.Source + req.Slug))
		hashStr := hex.EncodeToString(hash[:])

		parts := strings.Split(req.CoverBase64, ",")
		if len(parts) == 2 {
			data, err := base64.StdEncoding.DecodeString(parts[1])
			if err == nil {
				ext := ".jpg"
				if strings.Contains(parts[0], "png") {
					ext = ".png"
				} else if strings.Contains(parts[0], "webp") {
					ext = ".webp"
				}

				exePath, _ := os.Executable()
				coversDir := filepath.Join(filepath.Dir(exePath), "covers")
				os.MkdirAll(coversDir, 0755)

				filename := hashStr[:16] + ext
				fullPath := filepath.Join(coversDir, filename)

				err = os.WriteFile(fullPath, data, 0644)
				if err == nil {
					// Store relative path
					coverPath = "covers/" + filename
				} else {
					log.Printf("Failed to save cover: %v", err)
				}
			}
		}
	}

	if err := db.UpsertMangaAndChapter(req, coverPath); err != nil {
		log.Printf("Database Error: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"ok"}`))
}

func handleGetManga(db *Database, w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	mangas, err := db.GetAllManga()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if mangas == nil {
		mangas = []Manga{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(mangas)
}

type ActionRequest struct {
	ID int `json:"id"`
}

func handleDeleteManga(db *Database, w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req ActionRequest
	json.NewDecoder(r.Body).Decode(&req)

	if err := db.DeleteManga(req.ID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func handlePinManga(db *Database, w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req ActionRequest
	json.NewDecoder(r.Body).Decode(&req)

	if err := db.TogglePinManga(req.ID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}
