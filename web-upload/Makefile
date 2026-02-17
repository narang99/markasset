.PHONY: help serve dev build clean deploy test

# Default target
help:
	@echo "Available commands:"
	@echo "  serve         - Start local development server (port 3000)"
	@echo "  dev           - Alias for serve"
	@echo "  build         - Build for production (currently no build step needed)"
	@echo "  clean         - Clean temporary files"
	@echo "  deploy        - Deploy to Firebase Hosting"
	@echo "  test          - Open in browser for testing"

# Start development server
serve:
	@echo "Starting development server at http://localhost:3000"
	@echo "Press Ctrl+C to stop"
	npx serve .

# Alias for serve
dev: serve

# Build (for static files, no build step currently needed)
build:
	@echo "Static files are ready for deployment"
	@echo "Files: index.html, app.js, manifest.json, sw.js, icons/"

# Clean temporary files
clean:
	@echo "Cleaning temporary files..."
	rm -rf .DS_Store
	rm -rf Thumbs.db
	@echo "Clean complete"

# Deploy to Firebase Hosting (requires firebase-tools and project setup)
deploy: build
	@if ! command -v firebase >/dev/null 2>&1; then \
		echo "Firebase CLI not found. Installing..."; \
		npm install -g firebase-tools; \
	fi
	@if [ ! -f firebase.json ]; then \
		echo "Firebase not initialized. Run 'firebase init hosting' first."; \
		exit 1; \
	fi
	npx wrangler pages deploy
	# firebase deploy --only hosting

# Open in browser for testing
test:
	@echo "Opening web upload interface..."
	@if command -v open >/dev/null 2>&1; then \
		open http://localhost:3000; \
	elif command -v xdg-open >/dev/null 2>&1; then \
		xdg-open http://localhost:3000; \
	else \
		echo "Please open http://localhost:3000 in your browser"; \
	fi

# Quick setup for development
setup:
	@echo "Setting up web-upload development environment..."
	@echo "No dependencies to install (using CDN for Firebase SDK)"
	@echo "Ready to serve!"
