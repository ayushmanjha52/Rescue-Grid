# RESCUEGRID

Resilient Orchestration Platform for Disaster Response.
Asynchronous synchronization of Victims, Volunteers, and DMA in low connectivity, high-latency environments.

Live Link : https://rescuegrid-india.vercel.app/ (Victim PWA — report an emergency, SOS)
Live Link : https://rescuegrid-india.vercel.app/dma/login (DMA Dashboard, secured by auth; operator accounts are created by the owner)
Live Link : https://rescuegrid-india.vercel.app/volunteer/login (volunteers join and sign in with a phone number + PIN, no SMS needed)


# BANNER

<p align="center">
  <img 
    src="./rescuegrid/README/RESCUEGRID%20BANNER.jpeg" 
    alt="RescueGrid Hero Banner" 
    width="100%" 
    style="border-radius: 16px; box-shadow: 0 10px 30px rgba(255, 98, 0, 0.3);">
</p>

<br>

# Contents

- The Problem
CURRENT PAIN POINTS:
• Awareness Vacuum in Emergency Operations Centers.
• Communication Collapse during Infrastructure Failure.
• Massive Duplication of Effort & Resource Wastage.
• Exclusion of Most Vulnerable Populations.
• Critically Slow Response Time.

- The Solution
• Resilient Orchestration Platform.
• Eliminates Awareness Vacuum & Communication Collapse.
• True Offline-First Resilience.
• Novel AI that Judges Haven’t Seen.
• Seamless Government Plug-in.
• Built-in Business & Social Scalability


# Key Features

Offline-First Architecture
Victim Interaction Layer (PWA)
Operational Participation Layer (Volunteer PWA)
Coordination & Management Layer (DMA Dashboard)
AI Assistant (OpenAI SDK + Tool Calling + Supabase MCP)
Real-time + Resilient Sync
Low-Literacy & Accessibility Focused


# Architecture

<p align="center">
  <img 
    src="./rescuegrid/README/RESCUEGRID%20ARCHITECTURE.jpeg" 
    alt="RescueGrid Architecture" 
    width="100%" 
    style="border-radius: 16px; box-shadow: 0 10px 30px rgba(255, 98, 0, 0.3);">
</p>

<br>

 # Tech Stack

 Dashboard:
Next.js 16 (App Router) + React 19
Tailwind CSS + SIGNAL ORANGE theme
Backend & Database:
Supabase (PostgreSQL + Realtime + Auth + MCP)
Supabase Realtime (Single Data Layer)
Maps & Geolocation:
Mapbox API / Mapbox GL JS (offline-cacheable)
AI Layer:
OpenAI SDK (gpt-4o)
Tool Calling + Supabase MCP
Communication:
Web Push notifications for volunteers; phone number + PIN sign-in (no paid SMS)
Deployment:
Vercel (server in Tokyo, next to the Supabase database)
Fallback Channels:
SOS by SMS to 112 when there is no internet (optional Twilio number to receive SOS texts as reports)

- [Installation & Setup](./rescuegrid/README.md#getting-started)


# Ai-integration

Core Technologies
- OpenAI SDK (gpt-4o) with Tool Calling (Agentic capabilities)
- Supabase MCP (Model Context Protocol) – official natural-language database interface

 What the AI Does
- Understands natural language queries from DMA coordinators
- Automatically suggests the best volunteer for each task (distance + skill + load)
- Detects and merges duplicate reports
- Provides real-time guidance to victims
- Generates one-click escalation reports

Key Capabilities in RescueGrid:
 Volunteer Matching: AI scores and recommends the optimal volunteer
 Task Auto-Assignment: Suggests assignments with one-click approval
 Natural Language Queries: “Show all pending medical reports in Nirsa” → instant results
 Victim Assistant:Calm, step-by-step guidance in English/Hindi during emergencies



# Offline-First Strategy

What works today:
- SMS fallback: with no internet, the SOS button opens the phone's SMS app with GPS (or the last known location), the emergency type and the victim's note pre-filled. A Supabase Edge Function parses the SMS into a live report and texts back a reference number.
- Failed submissions: if the report form can't reach the server, it offers "Send by SMS instead" with everything already filled in.
- Duplicate protection: retries or double taps within 10 minutes (web or SMS) attach to the existing report instead of creating a new one.
- Live connection status: the victim and volunteer apps show when the device is offline.
- Volunteers get web-push notifications for missions and broadcasts, even with the app closed.

Roadmap (not built yet):
- IndexedDB write queue with background sync for volunteer actions.
- "Last synced X minutes ago" indicators on the DMA dashboard.

# Real-World Use Cases

• Victim / Affected Individual (Rural Low-Literacy
User).
• Volunteer / Field Participant.
• Coordinator / DDMA EOC (Admin Dashboard).
• End-to-End Scenario in Flash Flood /
Coal-Mine Waterlogging.
• On time stampede situation


# ERD & Database Schema
# Demo Flow 
 Victim App – Online Mode
   Victim opens the app (with internet)
   Selects problem type (Food / Rescue / Medical / Shelter etc.)
   Enters number of people affected
   Picks location (auto or manual)
   Enters phone number
   Submits report → instantly appears in DMA dashboard
 Victim App – Offline Mode (Emergency Fallback)
   No internet → UI clearly shows “Internet not available”
   Big Emergency Button appears
   Clicking it opens the native SMS app
   Pre-filled SMS with location + problem type is sent to our dedicated number
   SMS is automatically parsed and added to the DMA dashboard (Single Data Layer)
 Volunteer App
   Volunteer sees assigned tasks (individual or from Task Force)
   Views victim location on map + distance
   Sees resources allocated to them
   Updates task status (En Route / Completed / Not Completed)
   If part of a Task Force → accesses group messaging to coordinate with other members
  DMA Dashboard (Coordinator View)
   Views all victims and volunteers on live map
   Sees incoming messages/reports
   Creates tasks and assigns them to single volunteer or entire Task Force
   Assigns resources to volunteers and tracks usage
   Messages any volunteer or victim directly
Updates victim problem status (e.g., “Resolved”)
Monitors everything in real-time

# Future Roadmap 
 
 Phase 1: 
  Next 3–6 Months (Post-Hackathon)
    Implement true bidirectional offline sync using PowerSync or Electric SQL (so changes made on dashboard also reach offline users)
    Add drone & satellite imagery integration for real-time flood mapping
    Full USSD menu for feature phones (no smartphone needed)
    Production-grade Row Level Security (RLS) and user authentication
    Deploy both Victim + Volunteer apps to Google Play Store
Phase 2:
  6–12 Months (Regional Scale)
    Partner with Coal India CSR for dedicated Dhanbad coal-mine waterlogging module
    Integrate with official NDMA / JSDMA APIs for automatic escalation
    Add predictive AI (flood forecasting + crowd crush risk prediction)
    Task Force collaboration tools (voice calls, live location sharing inside groups)
    Resource inventory management with QR code scanning
Phase 3: 
  12+ Months (National Scale)
    Expand to all disaster-prone states (Bihar, Jharkhand, Uttar Pradesh, Assam, etc.)
    Mental health & GBV (Gender-Based Violence) support module
    Integration with government early-warning systems (IMD, CWC)
    Multi-language support (10+ Indian languages)
    Analytics dashboard for state & national disaster authorities
  Open-source core + SaaS model for NGOs and private companies
Ultimate Vision
RescueGrid will become the default orchestration layer for any large-scale disaster or mass gathering in India — from floods and stampedes to earthquakes and cyclones — ensuring zero communication collapse and maximum lives saved.

# Contributing

# License

# Team

KAUSHIK KUMAR SINHA
AYUSHMAN JHA 
