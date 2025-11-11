# Joblogger - Contracting Business Management Suite

![Joblogger Dashboard](placeholder-dashboard.png)

> A comprehensive, full-stack web application designed as a management tool for small contracting businesses, such as flooring installers. Joblogger provides a single, centralized platform to track the entire lifecycle of a job, from initial customer inquiry to final completion and payment.

## About The Project

For small contracting businesses, managing jobs, customers, materials, and schedules often involves a messy combination of spreadsheets, notebooks, and text messages. Joblogger was built to solve this problem by providing a modern, intuitive, and all-in-one solution tailored to the real-world workflows of the trade.

The application is built on a robust, containerized architecture, ensuring a stable and reproducible environment for both development and deployment.

---

## Key Features

✨ **Customer Relationship Management (CRM):**
- Create, view, edit, and delete a complete list of customers.
- View all projects associated with a specific customer.

✨ **Project & Job Tracking:**
- Manage individual jobs for each customer.
- Intelligent project statuses (`New`, `Quoting`, `Scheduled`, `Completed`) that update automatically based on user actions.
- Create and manage detailed quotes with breakdowns for materials and labor.
- Track change orders and automatically calculate their impact on the final balance.

✨ **Sample & Inventory Management:**
- Maintain a central "Sample Library" of materials with images and details.
- Robust, multi-step checkout and return process for samples on a per-project basis.
- **QR Code System:** Generate and print unique QR codes for each physical sample.
- **Live QR Scanning:** Use a device's camera to scan samples for a "Quick Checkout" workflow directly from the dashboard.

✨ **Installer & Schedule Management:**
- Manage a list of installers and their contact information.
- Assign installers to jobs via quotes.
- View all scheduled jobs on a color-coded, interactive calendar to prevent conflicts and manage workloads.

✨ **Backup & Restore:**
- **UI-Driven Backups:** Generate and download separate ZIP backups of the entire database and all uploaded images directly from a "Settings" page.
- **Disaster Recovery:** A secure, UI-driven restore process to fully recover all application data from backup files in case of data loss.

---

## Technology Stack

This project is built with a modern, full-stack architecture.

*   **Frontend:**
    *   [React](https://reactjs.org/) (with TypeScript)
    *   [Vite](https://vitejs.dev/)
    *   [Tailwind CSS](https://tailwindcss.com/)
    *   [Lucide Icons](https://lucide.dev/)

*   **Backend:**
    *   [Node.js](https://nodejs.org/)
    *   [Express.js](https://expressjs.com/)

*   **Database:**
    *   [PostgreSQL](https://www.postgresql.org/)

*   **DevOps & Tooling:**
    *   [Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/)
    *   [Gitea](https://gitea.io/) (or any Git provider)

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
    git clone <your-repository-url>
    cd joblogger
    ```

2.  **Create the Environment File:**
    Create a `.env` file in the root of the project. This file stores your database credentials. Make sure the values match the `environment` section of the `db` service in your `docker-compose.yml` file.
    ```env
    # .env
    POSTGRES_USER=user
    POSTGRES_PASSWORD=password
    POSTGRES_DB=joblogger
    ```

3.  **Build and Run the Application:**
    This command will build the necessary Docker images and start all three services (`app`, `server`, `db`) in the background. The `--build` flag is important for the first run to ensure all dependencies are installed correctly.
    ```sh
    docker-compose up --build -d
    ```

4.  **Access the Application:**
    Open your web browser and navigate to:
    **[http://localhost:5173](http://localhost:5173)**

The application should be fully functional. The database will be initialized automatically from the `schema.sql` file.

---

## Roadmap

While the core functionality is robust, there are several features planned for future development:

- [ ] **Editing & Deleting:** Add the ability to edit and delete Material Orders.
- [ ] **File Uploads:** Implement file uploads for "Signed Paperwork" on the Job Details page.
- [ ] **Advanced Business Logic:**
    -   UI warnings for Material ETA vs. Job Start Date conflicts.
    -   Drag-and-drop rescheduling on the calendar.
- [ ] **Authentication & Users:** Implement a full multi-user system with login and permissions.

See the open issues for a full list of proposed features (and known issues).

---

## License

Distributed under the MIT License. See `LICENSE.txt` for more information.

---