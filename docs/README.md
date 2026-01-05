# Unmai.ai Documentation

Welcome to the documentation repository for **Unmai.ai**. This project uses [Mintlify](https://mintlify.com/) for its documentation.

## Getting Started

Follow these steps to set up your local environment and preview the documentation.

### Prerequisites

- [Node.js](https://nodejs.org/) (version 18 or higher recommended)
- [Mintlify CLI](https://www.npmjs.com/package/mint)

### Installation

1.  **Install the Mintlify CLI:**

    ```bash
    npm i -g mint
    ```

2.  **Clone the repository:**

    If you haven't already, clone this repository to your local machine.

    ```bash
    git clone <your-repo-url>
    cd docs
    ```

3.  **Run the development server:**

    Navigate to the root of the documentation (where `mint.json` is located) and run:

    ```bash
    mint dev
    ```

4.  **Preview:**

    Open your browser and go to `http://localhost:3000` to see the documentation live. The preview will automatically update as you make changes to the files.

## Project Structure

- `mint.json`: The configuration file for the documentation site (navigation, theme, etc.).
- `essentials/`: Contains guides on using Markdown, code snippets, and images.
- `api-reference/`: Contains API documentation and OpenAPI specifications.
- `ai-tools/`: Documentation for AI tools integrations.

## Deployment

Changes pushed to the `main` branch are automatically deployed via the Mintlify GitHub App.

## Need Help?

- Check the [Mintlify Documentation](https://mintlify.com/docs) for more details on customization.