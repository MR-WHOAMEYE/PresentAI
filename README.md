# 🎤 Presentation Coach

An AI-powered presentation coaching assistant that helps you improve your public speaking skills with real-time feedback on eye contact, posture, gestures, speech rate, and filler words.

![Dark Theme Dashboard](https://via.placeholder.com/800x400/0a0a0a/6366f1?text=Presentation+Coach)

## ✨ Features

- **📹 Video Analysis** - Real-time pose and gesture detection using MediaPipe
- **👁 Eye Contact Tracking** - Monitors if you're looking at the camera
- **🗣 Speech Analysis** - Tracks speaking rate (WPM) and detects filler words
- **🤖 AI Coaching** - Gemini-powered feedback and suggestions
- **📊 Google Slides Integration** - Import presentations and save feedback to speaker notes
- **📈 Progress Tracking** - Review past sessions and track improvement over time
- **🎥 Session Recording** - Record practice sessions for playback

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ 
- **Python** 3.9+
- **MongoDB** (local or Atlas)
- **Google Cloud Console** account

### 1. Clone the Repository

```bash
cd "hackathon gdg"
```

### 2. Set Up Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable these APIs:
   - Google Slides API
   - Google Drive API
4. Go to **Credentials** → Create **OAuth 2.0 Client ID**
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:5000/auth/callback`
5. Download the credentials

### 3. Get Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create an API key

### 4. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
copy .env.example .env
# Edit .env with your credentials
```

Edit `backend/.env`:
```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5000/auth/callback
GEMINI_API_KEY=your_gemini_api_key
SECRET_KEY=your_random_secret_key
MONGO_URI=mongodb://localhost:27017/presentation_coach
FRONTEND_URL=http://localhost:5173
```

Start the backend:
```bash
python app.py
```

### 5. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env file
copy .env.example .env
```

Edit `frontend/.env`:
```env
VITE_API_URL=http://localhost:5000
VITE_GEMINI_API_KEY=your_gemini_api_key
```

Start the frontend:
```bash
npm run dev
```

### 6. Start MongoDB

```bash
# If using local MongoDB
mongod
```

### 7. Open the App

Visit [http://localhost:5173](http://localhost:5173) in your browser.

## 📱 Usage

### 1. Connect Google Account
Click "Connect Google" to authenticate with your Google account and grant access to Google Slides.

### 2. Import Presentation
Click "Import from Google Slides" to select a presentation to practice with.

### 3. Start Practice Session
Click "Start Practice Session" to begin. Allow camera and microphone access when prompted.

### 4. Practice with Feedback
- Watch your pose skeleton overlay on the video
- See real-time metrics for posture, eye contact, gestures, and speech
- Get AI-powered coaching tips every 30 seconds
- View live transcript with highlighted filler words

### 5. End Session & Review
Click "End Session" to finish. Review your:
- Overall score and grade
- Strengths and areas for improvement
- Next session goals
- Session recording playback

### 6. Save to Slides
Click "Add Feedback to Slides" to save your feedback summary to the first slide's speaker notes.

## 🛠 Tech Stack

### Frontend
- **Vanilla JavaScript** + Vite
- **MediaPipe Tasks Vision** - Pose and Face Landmarker
- **Web Speech API** - Speech-to-text
- **CSS3** - Dark glassmorphism theme

### Backend
- **Python Flask** - REST API
- **MongoDB** - Database
- **Google APIs** - OAuth, Slides, Drive
- **Google Gemini** - AI feedback generation

## 📁 Project Structure

```
hackathon gdg/
├── frontend/
│   ├── src/
│   │   ├── main.js              # App entry point
│   │   ├── styles/main.css      # Dark theme CSS
│   │   ├── services/            # API, Auth, Recording
│   │   └── analyzers/           # Pose, Face, Speech
│   ├── index.html
│   └── package.json
│
└── backend/
    ├── app.py                   # Flask app
    ├── config.py                # Configuration
    ├── models.py                # MongoDB models
    ├── routes/                  # API routes
    │   ├── auth.py
    │   ├── presentations.py
    │   ├── sessions.py
    │   └── analyze.py
    └── services/                # Business logic
        ├── google_auth.py
        ├── slides_service.py
        ├── drive_service.py
        └── gemini_service.py
```

## 🎨 Screenshots

### Dashboard
Dark themed dashboard with quick stats and actions

### Practice Session
Video preview with pose overlay and real-time metrics

### Feedback Screen
Session summary with AI-generated insights

### Progress Tracking
Charts and history of past sessions

## 🔗 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/google` | GET | Start OAuth flow |
| `/auth/callback` | GET | OAuth callback |
| `/auth/status` | GET | Check auth status |
| `/presentations` | GET | List user's slides |
| `/presentations/{id}` | GET | Get presentation data |
| `/sessions` | GET/POST | List/create sessions |
| `/analyze/realtime` | POST | Get real-time feedback |
| `/analyze/summary` | POST | Generate session summary |

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- [MediaPipe](https://developers.google.com/mediapipe) for pose and face detection
- [Google Gemini](https://ai.google.dev/) for AI-powered feedback
- [Google Slides API](https://developers.google.com/slides) for presentation integration

---

Built with ❤️ for the GDG Hackathon
