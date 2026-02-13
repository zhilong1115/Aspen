package main

import (
	"aspen/crypto"
	"database/sql"
	"fmt"
	"github.com/rs/zerolog/log"
	"os"

	_ "modernc.org/sqlite"
)

func main() {
	if len(os.Args) < 3 {
		fmt.Println("Usage: update-key <model_id_prefix> <new_api_key>")
		os.Exit(1)
	}

	modelPrefix := os.Args[1]
	newAPIKey := os.Args[2]

	// Initialize crypto service
	cryptoService, err := crypto.NewCryptoService("secrets/rsa_key")
	if err != nil {
		log.Fatal().Msgf("Failed to init crypto service: %v", err)
	}

	// Encrypt the API key
	encryptedKey, err := cryptoService.EncryptForStorage(newAPIKey)
	if err != nil {
		log.Fatal().Msgf("Failed to encrypt API key: %v", err)
	}

	// Open database
	db, err := sql.Open("sqlite", "config.db")
	if err != nil {
		log.Fatal().Msgf("Failed to open database: %v", err)
	}
	defer db.Close()

	// Update all matching models
	result, err := db.Exec(`
		UPDATE ai_models 
		SET api_key = ? 
		WHERE id LIKE ? AND provider = 'openrouter'
	`, encryptedKey, modelPrefix+"%")
	if err != nil {
		log.Fatal().Msgf("Failed to update: %v", err)
	}

	rows, _ := result.RowsAffected()
	fmt.Printf("Updated %d models with prefix '%s'\n", rows, modelPrefix)
}
