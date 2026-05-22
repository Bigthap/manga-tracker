package main

import (
	"crypto/rand"
	"embed"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/getlantern/systray"
	"github.com/getlantern/systray/example/icon"
)

//go:embed frontend/*
var frontendFS embed.FS

type Config struct {
	APIKey        string   `json:"api_key"`
	CustomDomains []string `json:"custom_domains"`
}

var appConfig Config

func loadOrGenerateConfig() error {
	exePath, err := os.Executable()
	if err != nil {
		return err
	}
	configPath := filepath.Join(filepath.Dir(exePath), "config.json")

	data, err := os.ReadFile(configPath)
	if err == nil {
		return json.Unmarshal(data, &appConfig)
	}

	// Generate new API Key
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return err
	}
	appConfig.APIKey = hex.EncodeToString(bytes)

	data, _ = json.MarshalIndent(appConfig, "", "  ")
	return os.WriteFile(configPath, data, 0600)
}

func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if strings.HasPrefix(origin, "chrome-extension://") || strings.HasPrefix(origin, "http://localhost") || origin == "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
		} else {
			// Fallback or reject
			w.Header().Set("Access-Control-Allow-Origin", "*")
		}
		
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	}
}

func authMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		expected := "Bearer " + appConfig.APIKey
		if auth != expected && r.URL.Path == "/api/track" {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	}
}

func main() {
	go func() {
		if err := loadOrGenerateConfig(); err != nil {
			log.Fatalf("Failed to load config: %v", err)
		}

		db, err := InitDB()
		if err != nil {
			log.Fatalf("Failed to init database: %v", err)
		}
		// Notice: defer db.Close() won't execute if os.Exit() is called, but OS handles cleanup.
		defer db.Close()

		// API Routes
		http.HandleFunc("/api/track", corsMiddleware(authMiddleware(func(w http.ResponseWriter, r *http.Request) {
			handleTrack(db, w, r)
		})))
		http.HandleFunc("/api/delete", corsMiddleware(authMiddleware(func(w http.ResponseWriter, r *http.Request) {
			handleDeleteManga(db, w, r)
		})))
		http.HandleFunc("/api/pin", corsMiddleware(authMiddleware(func(w http.ResponseWriter, r *http.Request) {
			handlePinManga(db, w, r)
		})))
		http.HandleFunc("/api/manga", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
			handleGetManga(db, w, r)
		}))
		http.HandleFunc("/api/config", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodGet {
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(appConfig)
			} else if r.Method == http.MethodPost {
				// We need auth to change config
				auth := r.Header.Get("Authorization")
				expected := "Bearer " + appConfig.APIKey
				if auth != expected {
					http.Error(w, "Unauthorized", http.StatusUnauthorized)
					return
				}

				var newConfig Config
				if err := json.NewDecoder(r.Body).Decode(&newConfig); err != nil {
					http.Error(w, err.Error(), http.StatusBadRequest)
					return
				}
				
				// Update domains
				appConfig.CustomDomains = newConfig.CustomDomains
				
				// Save to file
				exePath, _ := os.Executable()
				configPath := filepath.Join(filepath.Dir(exePath), "config.json")
				data, _ := json.MarshalIndent(appConfig, "", "  ")
				os.WriteFile(configPath, data, 0600)
				
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(map[string]string{"status": "success"})
			} else {
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			}
		}))

		// Serve cover images
		exePath, _ := os.Executable()
		coversDir := filepath.Join(filepath.Dir(exePath), "covers")
		os.MkdirAll(coversDir, 0755)
		http.Handle("/api/covers/", http.StripPrefix("/api/covers/", http.FileServer(http.Dir(coversDir))))

		// Serve Frontend
		fsys, err := fs.Sub(frontendFS, "frontend")
		if err != nil {
			log.Fatalf("Failed to create sub filesystem: %v", err)
		}
		http.Handle("/", http.FileServer(http.FS(fsys)))

		port := "8264"
		fmt.Printf("Manga Tracker Server running at http://localhost:%s\n", port)
		fmt.Printf("Your API Key: %s\n", appConfig.APIKey)

		log.Fatal(http.ListenAndServe(":"+port, nil))
	}()

	systray.Run(onReady, onExit)
}

func onReady() {
	systray.SetIcon(icon.Data)
	systray.SetTitle("Manga Tracker")
	systray.SetTooltip("Manga Tracker")

	mOpen := systray.AddMenuItem("Open Dashboard", "Open Dashboard in Browser")
	systray.AddSeparator()
	mQuit := systray.AddMenuItem("Quit", "Quit Manga Tracker")

	go func() {
		for {
			select {
			case <-mOpen.ClickedCh:
				exec.Command("rundll32", "url.dll,FileProtocolHandler", "http://localhost:8264").Start()
			case <-mQuit.ClickedCh:
				systray.Quit()
			}
		}
	}()
}

func onExit() {
	os.Exit(0)
}
