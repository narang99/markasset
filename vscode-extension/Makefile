.PHONY: help install build compile watch clean package install-local dev

# Default target
help:
	@echo "Available commands:"
	@echo "  install       - Install npm dependencies"
	@echo "  build         - Build the extension (alias for compile)"
	@echo "  compile       - Compile TypeScript to JavaScript"
	@echo "  watch         - Watch for changes and auto-compile"
	@echo "  clean         - Clean build artifacts"
	@echo "  clean-all     - Clean build artifacts AND node modules"
	@echo "  package       - Package extension as .vsix file"
	@echo "  install-local - Install extension locally in VSCode"
	@echo "  dev           - Start development mode (watch + install)"

# Install dependencies
install:
	npm install

# Build the extension
build: compile

# Compile TypeScript
compile:
	npm run compile

# Watch for changes
watch:
	npm run watch

# Clean build artifacts
clean:
	rm -rf out/
	rm -f *.vsix


clean-all: clean
	rm -rf node_modules

# Package extension as .vsix file
package: clean
	@if ! command -v vsce >/dev/null 2>&1; then \
		echo "Installing vsce (Visual Studio Code Extension manager)..."; \
		npm install -g vsce; \
	fi
	vsce package

# Install extension locally in VSCode
install-local: clean
	@echo "Installing MarkAsset extension locally..."
	@if [ -f *.vsix ]; then \
		echo "Found existing .vsix file, installing..."; \
		code --install-extension *.vsix; \
	else \
		echo "Creating package and installing..."; \
		$(MAKE) package; \
		code --install-extension *.vsix; \
	fi
	@echo "Extension installed! Reload VSCode to use it."

# Development mode - watch and install
dev: install
	@echo "Starting development mode..."
	@echo "Building extension..."
	@$(MAKE) compile
	@echo "Installing extension locally..."
	@$(MAKE) install-local
	@echo ""
	@echo "Development setup complete!"
	@echo "Run 'make watch' in another terminal to auto-compile on changes."
	@echo "Press F5 in VSCode to launch Extension Development Host."
