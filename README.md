# PokeBase

A Pokemon card collection tracker with social features. Users can sign up, add cards by entering the collector number (auto-detects name, image, set, rarity, and market price via the PokéTcg API), manage their collection, share it publicly, rate and like other collections, chat with other collectors, and more.

## Tech Stack

- **Backend:** Python 3.14 + FastAPI + SQLAlchemy
- **Database:** PostgreSQL (running on localhost:5432)
- **Frontend:** Vanilla HTML, CSS, JavaScript (no frameworks)
- **External API:** [PokéTcg API](https://pokemontcg.io) for card auto-detection
- **Auth:** JWT tokens with bcrypt password hashing

## Project Structure

```
PokeBase/
├── backend/
│   ├── main.py              # FastAPI app, all routes, static file serving
│   ├── database.py          # PostgreSQL connection via SQLAlchemy + psycopg
│   ├── models.py            # SQLAlchemy ORM models (User, Card, Rating, Like, Feedback, Report, ChatMessage)
│   ├── schemas.py           # Pydantic request/response schemas
│   ├── auth.py              # JWT creation, password hashing, get_current_user, get_admin_user
│   └── requirements.txt     # Python dependencies
├── frontend/
│   ├── index.html           # Home feed - browse public collections
│   ├── signup.html          # Signup page
│   ├── login.html           # Login page
│   ├── dashboard.html       # Main collection view with stats
│   ├── add.html             # Add card (collector number auto-detect)
│   ├── edit.html            # Edit existing card
│   ├── profile.html         # Public profile with rating/like/report/chat
│   ├── chat.html            # 1-to-1 messaging
│   ├── admin.html           # Admin panel (users, reports, feedback)
│   ├── view.html            # Public shared collection view (via share link)
│   ├── css/
│   │   └── style.css        # All styling (dark theme, card grid, forms, chat, admin)
│   └── js/
│       ├── auth.js          # Auth helpers, token management, nav bar, feedback modal
│       └── app.js           # Card CRUD, rendering, filtering, sharing, ratings, chat, admin
└── venv/                    # Python virtual environment (created during setup)
```

## Database Schema

### `users` table
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PRIMARY KEY | Auto-increment |
| username | VARCHAR(50) UNIQUE | Login identifier |
| email | VARCHAR(100) UNIQUE | |
| hashed_password | VARCHAR(255) | bcrypt hash |
| is_public | BOOLEAN DEFAULT FALSE | Collection visibility |
| is_admin | BOOLEAN DEFAULT FALSE | Admin role |
| is_banned | BOOLEAN DEFAULT FALSE | Banned users can't log in |
| created_at | TIMESTAMP | Default: now() |

### `cards` table
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PRIMARY KEY | Auto-increment |
| owner_id | INTEGER FK → users.id | Foreign key to users |
| pokedex_number | INTEGER NOT NULL | National dex number |
| name | VARCHAR(100) NOT NULL | Pokemon name |
| collector_number | VARCHAR(20) | Card number on the card |
| image_url | TEXT | Card image URL from PokéTcg API |
| quantity | INTEGER DEFAULT 1 | How many copies owned |
| rarity | VARCHAR(50) | Common, Uncommon, Rare, etc. |
| set_name | VARCHAR(100) | Card set name |
| condition | VARCHAR(50) | Mint, Near Mint, etc. |
| year | INTEGER | Set release year |
| market_value | DOUBLE PRECISION DEFAULT 0 | Auto-detected TCGPlayer market price |
| notes | TEXT | User notes |
| date_acquired | VARCHAR(20) | Date card was obtained |
| grade | VARCHAR(20) | e.g. "PSA 10" |
| is_foil | BOOLEAN DEFAULT FALSE | |
| is_holo | BOOLEAN DEFAULT FALSE | |
| created_at | TIMESTAMP | Default: now() |

### `ratings` table
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PRIMARY KEY | |
| user_id | FK → users.id | Who rated |
| target_user_id | FK → users.id | Whose collection |
| stars | INTEGER NOT NULL | 1-5 |
| created_at | TIMESTAMP | |
| | UNIQUE(user_id, target_user_id) | One rating per user per collection |

### `likes` table
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PRIMARY KEY | |
| user_id | FK → users.id | Who liked |
| target_user_id | FK → users.id | Whose collection |
| created_at | TIMESTAMP | |
| | UNIQUE(user_id, target_user_id) | One like per user |

### `feedback` table
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PRIMARY KEY | |
| user_id | FK → users.id | Who submitted |
| message | TEXT NOT NULL | |
| created_at | TIMESTAMP | |

### `reports` table
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PRIMARY KEY | |
| reporter_id | FK → users.id | Who reported |
| target_user_id | FK → users.id | Whose collection |
| reason | VARCHAR(255) | |
| status | VARCHAR(20) DEFAULT 'pending' | pending / reviewed / dismissed |
| created_at | TIMESTAMP | |

### `chat_messages` table
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PRIMARY KEY | |
| sender_id | FK → users.id | |
| receiver_id | FK → users.id | |
| message | TEXT NOT NULL | |
| is_read | BOOLEAN DEFAULT FALSE | |
| created_at | TIMESTAMP | |

## Setup Instructions

### 1. Prerequisites
- Python 3.14+
- PostgreSQL running on localhost:5432 with user `postgres` and password `Brakes66`

### 2. Create the database
```bash
PGPASSWORD=Brakes66 psql -U postgres -h localhost -c "CREATE DATABASE pokebase;"
```

### 3. Set up Python virtual environment
```bash
cd /home/lucas/PokeBase
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
```

### 4. Start the server
```bash
cd backend
source /home/lucas/PokeBase/venv/bin/activate
python main.py
```

### 5. Open in browser
```
http://localhost:8000
```

### 6. Make a user admin
After creating an account, make yourself admin:
```bash
cd backend
python main.py make-admin YOUR_USERNAME
```
Then restart the server.

## API Endpoints

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/signup` | No | Create account |
| POST | `/login` | No | Login → returns JWT |
| GET | `/me` | Yes | Get current user info |

### Cards
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/cards` | Yes | Add a new card |
| GET | `/cards` | Yes | Get all user's cards |
| GET | `/cards/stats` | Yes | Get collection stats |
| PUT | `/cards/{id}` | Yes | Update a card |
| DELETE | `/cards/{id}` | Yes | Delete a card |

### Sharing
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/share/{username}` | No | Get user's full collection |
| GET | `/share/link/{username}` | No | Generate base64-encoded share URL |
| PUT | `/users/public` | Yes | Toggle collection public/private |
| GET | `/collections/public` | No | List public collections (search, trending, pagination) |

### Ratings & Likes
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/collections/{username}/rate` | Yes | Rate a collection (1-5 stars) |
| DELETE | `/collections/{username}/rate` | Yes | Remove your rating |
| GET | `/collections/{username}/rating` | Yes | Get your rating + stats |
| POST | `/collections/{username}/like` | Yes | Toggle like |

### Feedback
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/feedback` | Yes | Submit feedback to admin |
| GET | `/admin/feedback` | Admin | List all feedback |
| DELETE | `/admin/feedback/{id}` | Admin | Delete feedback |

### Reports
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/collections/{username}/report` | Yes | Report a collection |
| GET | `/admin/reports` | Admin | List all reports |
| PUT | `/admin/reports/{id}` | Admin | Update report status |

### Chat
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/chat/conversations` | Yes | List conversations |
| GET | `/chat/{user_id}` | Yes | Get messages with a user |
| POST | `/chat/{user_id}` | Yes | Send message |
| PUT | `/chat/{user_id}/read` | Yes | Mark as read |
| GET | `/chat/unread/count` | Yes | Get unread count |

### Admin
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/admin/users` | Admin | List all users |
| PUT | `/admin/users/{id}/ban` | Admin | Toggle ban |
| DELETE | `/admin/users/{id}` | Admin | Delete user + all data |
| DELETE | `/admin/cards/{id}` | Admin | Delete any card |
| GET | `/admin/stats` | Admin | Platform stats |

### Frontend Pages
| Endpoint | Description |
|----------|-------------|
| `/` | Home feed - browse public collections |
| `/signup.html` | Signup page |
| `/login.html` | Login page |
| `/dashboard.html` | Collection dashboard |
| `/add.html` | Add new card (auto-detect) |
| `/edit.html?id=N` | Edit card N |
| `/profile.html?user=X` | View user X's public collection |
| `/chat.html` | Messaging interface |
| `/chat.html?user=X` | Chat with user X |
| `/admin.html` | Admin panel |
| `/view.html?data=...` | View shared collection |

## Key Features

### Social Features
- **Public Collections**: Toggle your collection to be visible on the home feed
- **Home Feed**: Browse all public collections with search and trending
- **Ratings**: Rate other collections 1-5 stars
- **Likes**: Like collections with a heart button
- **Chat**: 1-to-1 messaging with polling (every 3 seconds)
- **Reports**: Report inappropriate collections
- **Feedback**: Send private feedback to admins

### Admin Panel
- View all users with stats
- Ban/unban users
- Delete users and their data
- View and manage reports (pending/reviewed/dismissed)
- View and delete feedback
- Platform-wide statistics

### Auto-Detect
1. User types a collector number
2. Frontend queries PokéTcg API
3. Auto-fills: name, image, set, rarity, year, market price, holo/foil status

## Environment / Config

- **Server:** `0.0.0.0:8000`
- **Database:** `postgresql+psycopg://postgres:Brakes66@localhost:5432/pokebase`
- **JWT Secret:** `pokebase-secret-key-change-in-production-2024`
- **JWT Expiry:** 24 hours
# PokeBase
