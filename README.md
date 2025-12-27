# Subfloor - Contracting Business Management Suite

![Subfloor Dashboard](placeholder-dashboard.png)

> A comprehensive, full-stack web application designed as a management tool for small contracting businesses, such as flooring installers. Subfloor provides a single, centralized platform to track the entire lifecycle of a job, from initial customer inquiry to final completion.

## About The Project

Subfloor is one-hundred percent written by Google Gemini 2.5 and 3.0. The project was started in late October of 2025. I am not a coder, but I know enough to coax a viable product from Gemini. Although AI wrote the code, I designed every aspect of the project. And to be clear, there is no AI used in the program itself.  The images in the demo app are from Nano Banana and Sora 2.

The program was designed to tackle some basic job tracking, sample checkouts, and customer communication. It bloomed into valuable tool for company knowledge, commnunication and much more.

For small contracting businesses, managing jobs, customers, materials, and schedules often involves a messy combination of spreadsheets, notebooks, and text messages. Subfloor was built to solve this problem by providing a modern, intuitive, and all-in-one solution tailored to the real-world workflows of the trade.

The application is built on a robust, containerized architecture, ensuring a stable and reproducible environment for both development and deployment. It is fully responsive and **Mobile-Native Ready**, designed to be used by installers in the field as easily as admins in the office.

## Can You Trust This Project

This project runs completely on your hardware. The code is all here to evaluate. I think that you can trust this project as much as you can trust any other project, but use judgement and evaluate the program as you would any other.

I think the most important thing to keep in mind that there is no support offered for this software. And I might at any time decide to stop development no matter the state of the program.  

## Can You Contribute

I'm not sure. Feel free to open issues, but I'm not sure of the future of this project. I'll work on it for the time being, but this is completely a learning experience and I'm not sure if I want to integrate other features I might not be able to real world test.  Feel free to go fork yourself and make all the changes you desire.

---

## Key Features

✨ **Logistics & Scheduling (Major Feature):**
- **Smart Calendar:** A unified view of all Installations, Measurements, and Personal Appointments.
- **Google/Apple Calendar Sync:** Generate secure, private iCal subscription links to sync your work schedule to your personal phone automatically.
- **Logic-Aware:** The calendar visualizes Material Order ETAs alongside job start dates to prevent scheduling conflicts.

✨ **Customer Relationship Management (CRM):**
- Track leads, active customers, and project history.
- **Universal Search:** Instantly find Customers, Projects, Installers, or specific Sample Variants (e.g., "12x24") from a global command bar.

✨ **Project & Job Tracking:**
- Intelligent status workflow (`New` -> `Quoting` -> `Scheduled` -> `Completed`).
- **Job Notes Chat:** A timeline-based chat system for each project. **Pin important notes** (like Gate Codes) to automatically promote them to the calendar event description.
- Financial tracking with detailed Quotes, Change Orders, and PO management.

✨ **Sample & Inventory Management:**
- **Inventory 2.0:** Track products by Variant (Color, Size, Finish) with specific packaging data (Cartons/SF).
- **QR Code System:** Generate QR codes for samples. Scan them with the built-in mobile camera for instant "Check In/Check Out".
- **Visual Tracking:** See exactly which samples are Overdue, Extended, or Due Today with smart color-coded indicators.

✨ **Knowledge Base (Wiki):**
- A built-in, rich-text documentation system for SOPs, safety guides, and employee handbooks.
- Mobile-optimized reading mode for field staff.

✨ **Communication Hub:**
- **Automated Emails:** System automatically sends "Upcoming Job" reminders to customers and "Daily Manifests" to installers.
- **Internal Messaging:** Direct messaging between users and threaded project discussions.

---

## Technology Stack

This project is built with a modern, full-stack architecture designed for scale and reliability.

*   **Frontend:**
    *   [React](https://reactjs.org/) (TypeScript)
    *   [Vite](https://vitejs.dev/)
    *   [Tailwind CSS](https://tailwindcss.com/)
    *   [TanStack Query](https://tanstack.com/query/latest) (State Management)
    *   [Capacitor](https://capacitorjs.com/) (Native Android Wrapper)

*   **Backend:**
    *   [Node.js](https://nodejs.org/) & [Express.js](https://expressjs.com/)
    *   [SuperTokens](https://supertokens.com/) (Authentication & RBAC)
    *   [ical-generator](https://github.com/sebbo2002/ical-generator) (Calendar Feeds)

*   **Database:**
    *   [PostgreSQL](https://www.postgresql.org/) (Persistent Data)

*   **DevOps:**
    *   [Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/)
    *   Self-Healing Architecture (Auto-migrations, Health checks)

---

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

You must have Docker and Docker Compose installed on your machine.
- [Install Docker Engine](https://docs.docker.com/engine/install/)
- [Install Docker Compose](https://docs.docker.com/compose/install/)

### Installation

1.  **Clone the repository:**
    ```sh
    git clone https://github.com/adampdxdotcom/subfloor.git
    cd subfloor
    ```

2.  **Configure Environment Variables:**
    The application relies on environment variables for database credentials, timezone settings, and API keys. We provide an example file to get you started.
    
    Copy the example file to a real `.env` file:
    ```sh
    cp .env.example .env
    ```
    
    Open the new `.env` file in your text editor and adjust settings before first run.

    ```sh
    # .env
    PORT=5075
    DB_USER=postgres
    DB_PASSWORD=secure_password_here
    DB_NAME=subfloor
    SUPERTOKENS_API_KEY=some-long-random-string
    ```

3.  **Build and Run the Application:**
    This command will build the necessary Docker images and start all services (`app`, `server`, `db`) in the background. The `--build` flag is important for the first run to ensure all dependencies are installed correctly.
    ```sh
    docker-compose up --build -d
    ```

4.  **Access the Application:**
    Open your web browser and navigate to:
    **[http://localhost:5173](http://localhost:5173)**

    The application will launch a "Zero-Config" setup wizard on the first run to help you create your Admin account and configure your company details.

---

### Updating

1. **Backup Your Database and Images**
    Backups are free and only take a few minutes. 

2.  **Update the Code**
    Pull the new files from Git from your instance root.
    ```sh
    git pull
    ```    
3.  **Update Your Containers**
    Gracefully close the containers and rebuild the image.
    ```sh
    docker compose down && docker compose up --build -d
    ```
4.  **Check the Program**
    Hard-refresh your browser and/or check your logs
    ```sh
    docker logs --tail 50 subfloor-app
    ```

---

## License

Distributed under the MIT License. See `LICENSE.txt` for more information.