.PHONY: build run clean build-all install dev

# Build for current platform
build:
	@echo "Building for current platform..."
	go build -o dist/survey cmd/server/main.go

# Build for all platforms
build-all:
	@echo "Building for all platforms..."
	@mkdir -p dist

	@echo "Building for Linux amd64..."
	GOOS=linux GOARCH=amd64 go build -o dist/survey-linux-amd64 cmd/server/main.go

	@echo "Building for Linux arm64..."
	GOOS=linux GOARCH=arm64 go build -o dist/survey-linux-arm64 cmd/server/main.go

	@echo "Building for macOS amd64..."
	GOOS=darwin GOARCH=amd64 go build -o dist/survey-darwin-amd64 cmd/server/main.go

	@echo "Building for macOS arm64 (M1/M2)..."
	GOOS=darwin GOARCH=arm64 go build -o dist/survey-darwin-arm64 cmd/server/main.go

	@echo "Building for Windows amd64..."
	GOOS=windows GOARCH=amd64 go build -o dist/survey-windows-amd64.exe cmd/server/main.go

	@echo "All builds completed!"
	@ls -lh dist/

# Install dependencies
install:
	@echo "Installing Go dependencies..."
	go mod download
	go mod tidy

# Run development server
dev: install
	@echo "Starting development server..."
	go run cmd/server/main.go

# Run with custom port
run:
	@if [ -z "$(PORT)" ]; then \
		go run cmd/server/main.go; \
	else \
		go run cmd/server/main.go --port $(PORT); \
	fi

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -rf dist/
	rm -f survey.db
	@echo "Clean completed!"

# Help
help:
	@echo "Available commands:"
	@echo "  make install    - Install Go dependencies"
	@echo "  make dev        - Run development server"
	@echo "  make build      - Build for current platform"
	@echo "  make build-all  - Build for all platforms"
	@echo "  make run PORT=8080 - Run with custom port"
	@echo "  make clean      - Clean build artifacts"
