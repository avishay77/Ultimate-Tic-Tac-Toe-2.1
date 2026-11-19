import os
import sqlite3

DB_NAME = os.environ.get('DB_PATH', 'cyber_game.db')


def init_db():
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                status TEXT DEFAULT 'approved',
                is_admin INTEGER DEFAULT 0
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS matches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                player1 TEXT,
                player2 TEXT,
                winner TEXT,
                board_state TEXT,
                played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        # Migration for old databases without the board_state column
        try:
            cursor.execute("ALTER TABLE matches ADD COLUMN board_state TEXT")
        except sqlite3.OperationalError:
            pass
        cursor.execute("SELECT * FROM users WHERE username = 'admin'")
        if not cursor.fetchone():
            cursor.execute(
                "INSERT INTO users (username, password, status, is_admin) VALUES (?, ?, 'approved', 1)",
                ('admin', os.environ.get('ADMIN_PASSWORD', 'admin77')))
        conn.commit()


# board_state is a JSON string with the skins and the list of moves
def add_match(p1, p2, winner, board_state):
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO matches (player1, player2, winner, board_state) VALUES (?, ?, ?, ?)",
            (p1, p2, winner, board_state))
        conn.commit()


def get_users_statistics():
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT u.id, u.username, u.password, u.status, u.is_admin,
                   (SELECT COUNT(*) FROM matches WHERE matches.player1 = u.username OR matches.player2 = u.username) as total_games,
                   (SELECT COUNT(*) FROM matches WHERE matches.winner = u.username) as total_wins
            FROM users u
        ''')
        rows = cursor.fetchall()
        users_list = []
        for r in rows:
            users_list.append({
                "id": r[0],
                "username": r[1],
                "password": r[2],
                "status": r[3],
                "is_admin": r[4],
                "total_games": r[5],
                "total_wins": r[6]
            })
        return users_list


def register_user(username, password):
    try:
        with sqlite3.connect(DB_NAME) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO users (username, password, status) VALUES (?, ?, 'pending')",
                (username, password))
            conn.commit()
            return {"status": "success", "message": "registered_pending"}
    except sqlite3.IntegrityError:
        return {"status": "error", "message": "Username already exists"}


def login_user(username, password):
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT status, is_admin FROM users WHERE username = ? AND password = ?",
            (username, password))
        user = cursor.fetchone()
        if not user:
            return {"status": "error", "message": "Invalid username or password"}
        if user[0] != 'approved':
            return {"status": "error", "message": "Account is pending admin approval. Meanwhile you can enter as a guest"}
        return {"status": "success", "user_status": user[0], "is_admin": user[1]}


def is_user_admin(username):
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT is_admin FROM users WHERE username = ?", (username,))
        row = cursor.fetchone()
        return bool(row and row[0] == 1)


def get_leaderboard():
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT winner, COUNT(*) as wins
            FROM matches
            WHERE winner IS NOT NULL AND winner != 'Draw' AND winner != 'Computer'
            GROUP BY winner ORDER BY wins DESC LIMIT 10
        ''')
        return cursor.fetchall()


def admin_get_all_data():
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, username, password, status, is_admin FROM users")
        users = cursor.fetchall()
        # Row layout: [0]=id, [1]=player1, [2]=player2, [3]=winner, [4]=board_state, [5]=played_at
        cursor.execute("SELECT id, player1, player2, winner, board_state, played_at FROM matches ORDER BY id DESC")
        matches = cursor.fetchall()
        return {"users": users, "matches": matches}


def admin_approve_user(username):
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET status = 'approved' WHERE username = ?", (username,))
        conn.commit()
