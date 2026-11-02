# Ather Mobility Intelligence — stakeholder prototype

An interactive concept prototype with a rider phone experience and desktop workspaces for fleet, insurance and Ather reviewers. It retains the existing light partner console, dark rider app and supplied Ather logo.

> **Prototype status:** This is not an official Ather product and does not connect to Ather systems. The specialist agents, LLM Judge, predictive insights, insurer economics, telematics and workflow decisions are simulated. A real person must review and decide each AI recommendation.

## Run the demo

Requirements: Node.js 18 or later. There are no third-party packages.

```sh
npm start
```

Visit http://localhost:4173. On Windows, double-click `START-DEMO.bat`; on macOS/Linux, run `./start-demo.sh`.

## Demo profiles

Select a role on the sign-in screen. These credentials are intentionally seeded for the local demonstration only.

| Workspace | Email | Password |
| --- | --- | --- |
| Rider | `rider@ather.demo` | `Ride@123` |
| Fleet manager | `fleet@ather.demo` | `Fleet@123` |
| Insurance partner | `insurer@ather.demo` | `Insure@123` |
| Ather reviewer | `admin@ather.demo` | `Ather@123` |

The local backend issues in-memory demo sessions that end on sign-out or server restart. The rider account is linked to the Arjun Mehta illustrative profile. The other 71 profiles are named Demo Rider 11 through Demo Rider 72.

## Workspaces and working journeys

- **Rider:** phone-framed Home, RideScore, True Health and Account tabs; purpose-specific privacy settings; rider-authorised claim evidence actions; saved service requests with preferred dates; saved product demo requests.
- **Fleet:** fleet overview, vehicle register, aggregated rider safety, maintenance queue and privacy-thresholded road intelligence.
- **Insurance:** consent-filtered pseudonymous rider summaries, illustrative policy records, conversion and commission analytics. Partner responses omit individual rider profiles.
- **Ather reviewer:** overview, specialist-agent workbench, Judge brief, mandatory human review queue, commercial impact and audit/governance views.

An AI workflow creates a **Pending** item. It cannot approve itself. Only the Ather reviewer account can approve, reject or return an item for more data. A recommendation record is created only after the reviewer approves it, and the action is audited.

All visible navigation, tabs, theme control, forms and workflow buttons have a defined action. Data changes are stored in `data.json`; the day/night theme is stored in the browser. Consent changes, claim actions, review decisions, service requests and demo requests return success/error feedback.

## Sample data and assumptions

`data.json` includes **72 uniquely identified rider profiles** and illustrative fleet, vehicle, policy, claim, recommendation and AI-review examples. Every rider record carries the `SYNTHETIC · ILLUSTRATIVE` label. No personal records, production telemetry or external repository data are included.

EV activity ranges, operating patterns, health indices, scores, conversion rates, commissions, and service/insurance scenarios are **prototype assumptions** made to exercise the interface. They are not Ather measurements or research findings. No external EV facts were needed to construct the sample set, so this version does not present external statistics as evidence. The supplied Ather logo in `public/ather-logo.png` is used in the header and rider phone. The separate legacy HTML/reference folder mentioned in the task was not present in the accessible project; the existing prototype’s own visual direction was retained.

## Setup and end-to-end checks

```sh
npm run check
npm run test:e2e
```

The end-to-end test starts a local test server on port 4175 and checks sign-in, role-restricted access, privacy-filtered data, the 72 unique synthetic records, saved rider requests, validation, human review, recommendation creation, audit access and a reset to the seeded state.

During this iteration, I also walked through the browser UI for all four profiles. The admin workflow was run and approved from the Human review page; rider demo and service requests were saved and displayed in the rider experience. `npm run check` passed. The API test harness is included, but its local socket-based run was blocked by the current execution environment's loopback restrictions; run `npm run test:e2e` on your machine to execute that full API suite.

## API guide

All `/api/*` endpoints except `POST /api/login` require `Authorization: Bearer <session-token>`. Login credentials and session tokens are for this local prototype only. Role restrictions are enforced on the server.

| Method and path | Access | Purpose |
| --- | --- | --- |
| `POST /api/login` | Public | `{ "email", "password" }` → demo session token and role profile |
| `POST /api/logout` | Signed in | End the current in-memory session |
| `GET /api/state` | Signed in | Workspace state filtered by role, sample data and aggregate analytics |
| `GET /api/analytics` | Signed in | Aggregate KPIs |
| `GET /api/insurance/summary` | Insurer, Ather | Pseudonymous consented rider rows, policy samples and aggregate KPIs |
| `GET /api/audit` | Ather reviewer | Audit events |
| `POST /api/agent-runs` | Ather reviewer | `{ "riderId", "purpose" }` → simulated agent/Judge analysis, pending human review |
| `POST /api/reviews/:id` | Ather reviewer | `{ "decision": "Approved" | "Rejected" | "Needs more data", "note" }` → persisted human decision |
| `PATCH /api/riders/:id/consent` | Matching rider | `{ "purpose": "ridescore" | "insurance" | "claims" | "offers", "granted": true }` |
| `PATCH /api/claims/:id` | Matching rider | Rider-authorised evidence action; sharing requires claims consent |
| `POST /api/service-requests` | Rider | `{ "service", "preferredDate": "YYYY-MM-DD" }` |
| `POST /api/demo-requests` | Rider | Save a product walkthrough request |
| `POST /api/reset` | Ather reviewer | Restore the seeded illustrative sample state |

The JSON file is a simple local persistence layer, not a production database. Sessions reset when the server restarts. The demo credentials are visible by design and must not be reused outside this local walkthrough.

## Brand and implementation notes

The design retains the prototype's Hanken Grotesk / IBM Plex Mono typography, green accent (`#3DDC84`), light desktop consoles, dark rider interface, phone frame and bottom navigation. The logo source available in this project is the supplied `public/ather-logo.png`; use of the logo is for this concept demonstration.

The “agents” are deterministic demo logic and the “LLM Judge” is a simulated policy-checking step. Neither production AI nor trained ML is integrated. Insurer underwriting, premium decisions, claim adjudication and live service booking are outside this prototype. Synthetic model outputs must not be used for real-world decisions.
