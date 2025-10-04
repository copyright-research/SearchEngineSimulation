# Copyright Search 🔍

A modern, fast, and elegant search engine powered by Google Custom Search API, built with Next.js 15.

![Next.js](https://img.shields.io/badge/Next.js-15.5-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38bdf8?logo=tailwind-css)

## ✨ Features

- 🎨 **Beautiful UI**: Modern gradient design with smooth animations
- ⚡ **Fast**: Server-side rendering with Next.js App Router
- 🔒 **Secure**: Built-in rate limiting and API protection
- 📱 **Responsive**: Works perfectly on mobile and desktop
- ⌨️ **Keyboard Shortcuts**: Press `/` to focus search
- 🖼️ **Rich Results**: Displays thumbnails and favicons
- 🎯 **Type-safe**: Full TypeScript support

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ or Bun
- Google Cloud account (for API keys)

### Installation

1. **Clone and install dependencies**:
```bash
npm install
```

2. **Configure environment variables**:
```bash
cp env.example .env.local
```

Edit `.env.local` and add your credentials:
```env
GOOGLE_API_KEY=your_google_api_key_here
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id_here
```

See [SETUP.md](./SETUP.md) for detailed instructions on obtaining API keys.

3. **Run the development server**:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## 🔒 Security

This project includes multiple layers of security:

- ✅ **Rate Limiting**: 10 requests/hour per IP
- ✅ **Daily Quota**: 90 requests/day globally (protects free tier)
- ✅ **Input Validation**: Query length limits and sanitization
- ✅ **API Protection**: Keys stored server-side only
- ✅ **Security Headers**: XSS, clickjacking protection

See [SECURITY.md](./SECURITY.md) for detailed security configuration.

### Current Limits

- **Per IP**: 10 searches per hour
- **Global**: 90 searches per day (protects Google's 100/day free quota)

To adjust limits, edit `app/api/search/route.ts`:
```typescript
const ipLimiter = rateLimit({
  interval: 60 * 60 * 1000, // 1 hour
  maxRequests: 10, // Adjust this
});
```

## 📁 Project Structure

```
copyright/
├── app/
│   ├── api/search/          # Search API endpoint
│   ├── page.tsx             # Main search page
│   └── layout.tsx           # Root layout
├── components/
│   ├── SearchBar.tsx        # Search input component
│   └── SearchResults.tsx    # Results display
├── lib/
│   ├── google-search.ts     # Google API wrapper
│   └── rate-limit.ts        # Rate limiting logic
├── types/
│   └── search.ts            # TypeScript types
└── vercel.json              # Vercel configuration
```

## 🎨 Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **API**: [Google Custom Search API](https://developers.google.com/custom-search)
- **Deployment**: [Vercel](https://vercel.com/)

## 🌐 Deployment

### Deploy to Vercel (Recommended)

1. Push your code to GitHub
2. Import project in [Vercel](https://vercel.com/new)
3. Add environment variables:
   - `GOOGLE_API_KEY`
   - `GOOGLE_SEARCH_ENGINE_ID`
4. Deploy!

The app will be live with automatic HTTPS and global CDN.

## 💰 Cost Estimation

### Google Custom Search API
- **Free Tier**: 100 searches/day
- **Paid**: $5 per 1,000 queries

### Current Configuration
With rate limiting (10/hour/IP + 90/day global), you'll stay within the free tier for small-scale usage.

## 📚 Documentation

- [SETUP.md](./SETUP.md) - Detailed setup instructions
- [SECURITY.md](./SECURITY.md) - Security configuration guide

## 🛠️ Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## 🎯 Keyboard Shortcuts

- `/` - Focus search input
- `Esc` - Blur search input
- `Enter` - Submit search

## 📝 License

MIT

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or submit PRs.

---

Built with ❤️ using Next.js and Google Custom Search API