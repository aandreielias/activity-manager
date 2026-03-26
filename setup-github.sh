#!/bin/bash

# GitHub Pages Setup Helper Script
# This script helps you set up GitHub API credentials for GitHub Pages deployment

echo "================================"
echo "Activity Manager - GitHub Setup"
echo "================================"
echo ""

# Check if .env already exists
if [ -f .env ]; then
    echo "⚠️  .env file already exists. Opening for editing..."
    read -p "Edit .env now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Try to open with default editor
        if command -v nano &> /dev/null; then
            nano .env
        elif command -v vim &> /dev/null; then
            vim .env
        else
            echo "Please edit .env manually with your favorite editor"
        fi
    fi
else
    echo "Creating .env file..."
    cp .env.example .env
    echo "✅ .env file created from .env.example"
    echo ""
    echo "📋 Next steps:"
    echo "1. Get your Personal Access Token from: https://github.com/settings/tokens"
    echo "2. Edit .env and fill in:"
    echo "   - VITE_GITHUB_OWNER: your GitHub username"
    echo "   - VITE_GITHUB_REPO: your repository name"
    echo "   - VITE_GITHUB_TOKEN: your personal access token"
    echo ""
    echo "3. Save and close the editor"
    echo "4. Run: npm run build"
    echo "5. Deploy the dist/ folder to GitHub Pages"
fi

echo ""
echo "📚 For detailed setup instructions, see: SAVING_GUIDE.md"

