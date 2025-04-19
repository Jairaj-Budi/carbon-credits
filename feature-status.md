# Feature Status & Progress Tracking

This document tracks the implementation status of features outlined in the project presentation.

## Implemented & Partially Implemented Features

### 1. Organization Management

*   **Status:** Partially Implemented / Buggy
*   **Description:** Allows organizations to register, but the verification/approval workflow and member management have issues. Basic profile viewing/editing might exist.
*   **Key Files/Components:**
    *   `@client/src/components/organization-registration.tsx`: Handles the initial registration form.
    *   `@client/src/pages/org-admin-dashboard.tsx`: Intended for managing the organization, viewing members, etc. (Currently lacking features).
    *   `@client/src/pages/system-admin-dashboard.tsx`: Intended for system admins to approve organizations. (Approval mechanism might be missing/incomplete).
    *   `@server/routes.ts`: Contains API endpoints for creating, fetching, and potentially updating organizations and handling membership (e.g., `/api/organizations`, `/api/users/:userId/join/:orgId`).
    *   `@server/storage.ts` / `@server/sqlite-storage.ts`: Handles database operations for organizations and user-organization relationships.
*   **Notes/Issues:**
    *   The user reported that the employee enrollment flow is incorrect. Employees should request to join an organization *before* logging commutes.
    *   Organization admins cannot see pending requests from employees.
    *   The approval workflow for new organizations by system admins needs verification.
    *   Org Admin Dashboard features are largely incomplete.

### 2. User Management

*   **Status:** Partially Implemented
*   **Description:** Core authentication (login/signup) and role-based access control seem to be in place, separating System Admin, Org Admin, and Employee views. Basic profile management likely exists.
*   **Key Files/Components:**
    *   `@client/src/pages/auth-page.tsx`: Handles login and signup UI.
    *   `@client/src/components/auth/`: Contains authentication-related UI components.
    *   `@client/src/pages/employee-dashboard.tsx`, `@client/src/pages/org-admin-dashboard.tsx`, `@client/src/pages/system-admin-dashboard.tsx`: Role-specific views.
    *   `@server/auth.ts`: Manages authentication logic, sessions, and authorization middleware.
    *   `@server/routes.ts`: Defines user-related endpoints (e.g., `/api/auth/login`, `/api/auth/signup`, `/api/users/me`).
    *   `@server/storage.ts` / `@server/sqlite-storage.ts`: Handles user data storage.
*   **Notes/Issues:**
    *   Needs integration with the corrected Organization Management flow for employee enrollment.
    *   Profile editing features might need enhancement.

### 3. Commute Tracking

*   **Status:** Implemented (Core logging) / Partially Implemented (History/Context)
*   **Description:** Users can log commutes, select transportation modes, and calculate distance. History viewing might be basic or missing.
*   **Key Files/Components:**
    *   `@client/src/components/commute-log-form.tsx`: UI for submitting commute logs.
    *   `@client/src/components/commute-distance-modal.tsx`: Likely assists with distance input/calculation.
    *   `@client/src/pages/employee-dashboard.tsx`: Where commute logging is initiated and history might be displayed.
    *   `@server/routes.ts`: Contains endpoints for creating and fetching commute logs (e.g., `/api/commutes`).
    *   `@server/storage.ts` / `@server/sqlite-storage.ts`: Stores commute log data.
*   **Notes/Issues:**
    *   Currently accessible directly after employee creation, bypassing the necessary organization enrollment step.
    *   Commute history display needs implementation or verification.

### 4. Carbon Credits System

*   **Status:** Implemented (Core Logic) / Partially Implemented (UI/Clarity)
*   **Description:** Organizations earn credits from employee commutes. The Org Admin dashboard displays 'Total Credits' earned, a 'Virtual Balance' (monetary balance for marketplace transactions), 'Total Sold Credits', and 'Total Revenue' from sales. The Marketplace allows Org Admins to create listings to sell credits and view/purchase active listings from others.
*   **Key Files/Components:**
    *   `@client/src/components/marketplace.tsx`: UI for creating/viewing/purchasing listings.
    *   `@client/src/pages/org-admin-dashboard.tsx`: Displays organization's credit stats and integrates the Marketplace component. Fetches data from `/api/organizations/:id/analytics` and `/api/marketplace/history`.
    *   `@server/routes.ts`:
        *   `/api/commute-logs` (POST): Updates organization `totalCredits` when a commute is logged.
        *   `/api/listings` (POST): Creates a new listing, checks `totalCredits`.
        *   `/api/listings` (GET): Fetches active listings for display.
        *   `/api/purchases/:id` (POST): Handles the purchase transaction, updating buyer/seller `virtualBalance` and `totalCredits`, marks listing as 'sold'.
        *   `/api/organizations/:id/analytics` (GET): Provides `totalCredits` and `virtualBalance`.
        *   `/api/marketplace/history` (GET): Provides `totalSoldCredits` and `totalSoldValue` (revenue) for the org.
    *   `@server/storage.ts` / `@server/sqlite-storage.ts`: Handles database operations for credits (`organizations` table), `listings` table, and potentially transactions.
*   **Notes/Issues:**
    *   The calculation logic for credits earned per commute (`calculateCommutePoints`) exists but might need verification against specific requirements.
    *   The concept of 'Virtual Balance' might need clearer explanation to users; currently functions as a cash balance for buying/selling credits.
    *   Need to ensure organizations have a way to obtain an initial 'Virtual Balance' if they are expected to buy credits before selling any.
    *   Employee dashboard needs UI to display individual credit balance/history.

### 5. Analytics Dashboards

*   **Status:** Partially Implemented
*   **Description:** Dedicated dashboard components exist. Org Admin dashboard (`@client/src/components/analytics-dashboard.tsx`) uses `/api/analytics/organization-summary` and `/api/analytics/marketplace`. System Admin dashboard (`@client/src/components/system-analytics-dashboard.tsx`) uses `/api/analytics/system`. Data aggregation and visualization are present but may need refinement.
*   **Key Files/Components:**
    *   `@client/src/components/analytics-dashboard.tsx`: Displays org-specific analytics.
    *   `@client/src/components/system-analytics-dashboard.tsx`: Displays system-wide analytics.
    *   `@client/src/pages/org-admin-dashboard.tsx`, `@client/src/pages/system-admin-dashboard.tsx`: Integrate the dashboard components.
    *   `@server/routes.ts`: Contains `/api/analytics/*` endpoints providing aggregated data.
    *   `@server/storage.ts` / `@server/sqlite-storage.ts`: Implements logic to query and aggregate data for analytics endpoints.
*   **Notes/Issues:**
    *   Specific charts/graphs need verification against presentation requirements.
    *   Real-time updates are likely not implemented.

## Pending Features (Not Started)

Based on the presentation script's "Future Roadmap":

1.  **Mobile Application Development:** Native or PWA mobile app.
2.  **Integration with Public Transport Systems:** Automatically fetch commute data.
3.  **Advanced Analytics Dashboard:** More detailed reporting and filtering options.
4.  **Community Features and Social Sharing:** Leaderboards, team challenges, etc.
5.  **Gamification Elements:** Badges, points, rewards beyond basic credits.

## Key Areas Needing Immediate Attention

1.  **Employee-Organization Enrollment Flow:** Rework the user flow so employees must request and be approved by an organization *before* accessing commute logging. Implement the necessary UI for admins to view and approve requests (`@client/src/pages/org-admin-dashboard.tsx` shows pending approvals, but the flow needs checking).
2.  **Dashboard Completeness (Org Admin):** While core marketplace functions, employee approval, and analytics display exist, review overall flow and ensure all intended member management features are present or planned.
3.  **Carbon Credit Display & History (Employee):** Implement UI elements for employees (`@client/src/pages/employee-dashboard.tsx`) to view their individual credit balance and transaction/earning history.
4.  **Virtual Balance Initialization (Optional):** Clarify if/how organizations get an initial 'Virtual Balance' to participate in buying credits.

1.  **Dashboard Completeness:** Flesh out the Org Admin and System Admin dashboards with the features described (member management, pending approvals, analytics display).
2.  **Carbon Credit Display & History:** Implement clear UI elements for users and organizations to view their credit balance and transaction history. 