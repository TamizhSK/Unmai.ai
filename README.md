<div align="center">
  <img src="frontend/public/unmaiai.png" alt="Unmai.ai Logo" width="200"/>
  <h1>Unmai.ai</h1>
  <p>
    <b>AI-powered content verification and analysis platform to combat misinformation.</b>
  </p>
  <p>
    <a href="https://github.com/your-repo/unmai.ai/actions/workflows/deploy.yml">
      <img src="https://img.shields.io/github/actions/workflow/status/your-repo/unmai.ai/deploy.yml?branch=main&style=for-the-badge" alt="Build Status"/>
    </a>
    <a href="https://github.com/your-repo/unmai.ai/blob/main/LICENSE">
      <img src="https://img.shields.io/github/license/your-repo/unmai.ai?style=for-the-badge" alt="License"/>
    </a>
    <a href="https://github.com/your-repo/unmai.ai/issues">
      <img src="https://img.shields.io/github/issues/your-repo/unmai.ai?style=for-the-badge" alt="GitHub issues"/>
    </a>
  </p>
</div>

---

## 🌟 About Unmai.ai

Unmai.ai is a powerful, AI-driven platform designed to help users navigate the digital world with confidence. It provides a comprehensive suite of tools to verify content, identify misinformation, detect deepfakes, and assess the credibility of various media types, including text, images, audio, and video.

## ✨ Key Features

- ** Fact-Checking:** Verify claims against a vast database of reliable sources.
- ** Deepfake Detection:** Analyze media to detect AI-generated or manipulated content.
- ** Credibility Scoring:** Get an instant assessment of content trustworthiness.
- ** Safety Assessment:** Evaluate content for harmful or malicious material.
- ** Source Verification:** Authenticate the source and domain of the content.
- ** Educational Insights:** Gain context and learn about misinformation indicators.
- ** Web Analysis:** Analyze web pages for safety and credibility.
- ** Multilingual Support:** Translate and analyze content in multiple languages.

## 🛠️ Technology Stack

Our platform is built with a modern, scalable technology stack to deliver reliable and fast analysis.

### **Frontend**
- **Next.js 15** (App Router)
- **React 18** with TypeScript
- **Tailwind CSS** & **shadcn/ui**
- **Radix UI** & **Lucide React** for icons

### **Backend**
- **Google Genkit AI** Framework
- **Node.js** with TypeScript
- **Google Cloud** Services

### **Google Cloud Services Used**

| Service | Logo |
| :--- | :---: |
| **Vertex AI** | <img src="frontend/public/Vertex AI.png" alt="Vertex AI" width="150"> |
| **Cloud Vision API** | <img src="frontend/public/Cloud Vision API.png" alt="Cloud Vision API" width="150"> |
| **Video Intelligence API** | <img src="frontend/public/Video Intelligence API.png" alt="Video Intelligence API" width="150"> |
| **Speech-To-Text** | <img src="frontend/public/Speech-To-Text.png" alt="Speech-To-Text" width="150"> |
| **Cloud Translation API** | <img src="frontend/public/Cloud Translation API.png" alt="Cloud Translation API" width="150"> |
| **Web Risk API** | <img src="frontend/public/Web Risk.png" alt="Web Risk API" width="150"> |
| **Firestore** | <img src="frontend/public/Firestore.png" alt="Firestore" width="150"> |
| **Cloud Run** | <img src="frontend/public/Cloud Run.png" alt="Cloud Run" width="150"> |
| **Cloud Build** | <img src="frontend/public/Cloud Build.png" alt="Cloud Build" width="150"> |


## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-repo/unmai.ai.git
    cd unmai.ai
    ```

2.  **Install all dependencies:**
    ```bash
    npm run install:all
    ```

3.  **Set up environment variables:**
    - **Backend:** Create a `.env` file in the `backend/` directory. You'll need your Google Cloud credentials.
    - **Frontend:** Create a `.env.local` file in the `frontend/` directory for your frontend configuration.

4.  **Run the development servers:**
    ```bash
    npm run dev
    ```
    This will start the frontend on `http://localhost:3000` and the backend services concurrently.

## 📜 Available Scripts

- `npm run dev`: Start both frontend and backend development servers.
- `npm run build`: Build both applications for production.
- `npm run start`: Start the production-ready servers.
- `npm run clean`: Remove all build artifacts and `node_modules`.
- `npm run typecheck`: Run TypeScript checks across the monorepo.

## 🤝 Contributing

Contributions are welcome! Please feel free to open an issue or submit a pull request.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <em>Made with ❤️ by the Unmai.ai Team</em>
</div>