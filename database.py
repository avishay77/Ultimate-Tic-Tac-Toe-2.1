import sqlite3

DB_NAME = 'cyber_game.db'

# שונה: נמחקו הייבוא של hashlib והפונקציה hash_password - הסיסמאות נשמרות כטקסט רגיל

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
        # הוספת עמודת board_state לטבלת המשחקים
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
        # --- חדש: מיגרציה לדאטאבייס ישן ---
        # אם קובץ ה-DB נוצר לפני שהוספנו את העמודה board_state, הפקודה CREATE TABLE IF NOT EXISTS
        # לא תוסיף אותה (כי הטבלה כבר קיימת), ולכן מוסיפים אותה ידנית.
        # אם העמודה כבר קיימת SQLite זורק OperationalError - ואז פשוט ממשיכים הלאה.
        try:
            cursor.execute("ALTER TABLE matches ADD COLUMN board_state TEXT")
        except sqlite3.OperationalError:
            pass  # העמודה כבר קיימת
        cursor.execute("SELECT * FROM users WHERE username = 'admin'")
        if not cursor.fetchone():
            cursor.execute("INSERT INTO users (username, password, status, is_admin) VALUES (?, ?, 'approved', 1)",
                           ('admin', 'admin77'))  # שונה: סיסמה רגילה במקום hash_password('admin77')
        conn.commit()

# עדכון פונקציית שמירת המשחק כך שתקבל גם את מצב הלוח
# board_state הוא מחרוזת JSON: {"x": סקין איקס, "o": סקין עיגול, "moves": [{"id": מספר כפתור, "p": 1/2}, ...]}
def add_match(p1, p2, winner, board_state):
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO matches (player1, player2, winner, board_state) VALUES (?, ?, ?, ?)", 
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

def register_user(username, password):  # מגדיר את פונקציית ההרשמה, שמקבלת שם משתמש וסיסמה מהשרת
    try:  # מתחיל בלוק ניסיון, כי ההכנסה למסד הנתונים נכשלת אם שם המשתמש כבר קיים
        with sqlite3.connect(DB_NAME) as conn:  # פותח חיבור לקובץ מסד הנתונים וסוגר אותו אוטומטית בסוף הבלוק
            cursor = conn.cursor()  # יוצר "סמן" (cursor), האובייקט שדרכו מריצים פקודות SQL
            cursor.execute("INSERT INTO users (username, password, status) VALUES (?, ?, 'pending')",
                           (username, password))  # שונה: מכניס משתמש חדש עם status='pending' (ממתין לאישור מנהל). לפני כן הסטטוס נלקח מברירת המחדל 'approved', ולכן כולם נכנסו מיד. סימני ה-? מוחלפים בערכים שבסוגריים, וזה מגן מפני SQL injection
            conn.commit()  # שומר את השינוי בקובץ מסד הנתונים באופן סופי
            return {"status": "success", "message": "registered_pending"}  # מחזיר לשרת הצלחה, והשרת בונה ממנה הודעה ללקוח
    except sqlite3.IntegrityError:  # תופס את השגיאה שנזרקת כששם המשתמש כבר קיים (עמודת username מוגדרת UNIQUE)
        return {"status": "error", "message": "Username already exists"}  # מחזיר שגיאה ששם המשתמש תפוס

def login_user(username, password):
    # מגדיר את פונקציית ההתחברות, שמקבלת שם משתמש וסיסמה מהשרת
    with sqlite3.connect(DB_NAME) as conn:
        # פותח חיבור למסד הנתונים וסוגר אותו אוטומטית בסוף הבלוק
        cursor = conn.cursor()
        # יוצר סמן (cursor) שדרכו מריצים פקודות SQL
        cursor.execute("SELECT status, is_admin FROM users WHERE username = ? AND password = ?",
                       (username, password))
        # מחפש משתמש ששם המשתמש והסיסמה שלו תואמים, ושולף ממנו את הסטטוס ואת שדה המנהל
        user = cursor.fetchone()
        # לוקח את השורה הראשונה שנמצאה, או None אם לא נמצאה אף שורה
        if not user:
            # אם לא נמצא משתמש, כלומר השם או הסיסמה שגויים
            return {"status": "error", "message": "Invalid username or password"}
            # מחזיר שגיאת פרטים שגויים
        if user[0] != 'approved':
            # חדש: user[0] הוא הסטטוס. אם הוא לא 'approved', המנהל עדיין לא אישר את המשתמש
            return {"status": "error", "message": "Account is pending admin approval. Meanwhile you can enter as a guest"}
            # חדש: חוסם את הכניסה ומסביר למשתמש למה, ומציע לו להיכנס כאורח
        return {"status": "success", "user_status": user[0], "is_admin": user[1]}
        # אם הגענו לכאן המשתמש קיים ומאושר, אז מחזיר הצלחה עם הסטטוס ועם 1/0 לפי אם הוא מנהל

def is_user_admin(username):  # חדש: פונקציה שבודקת אם משתמש מסוים הוא מנהל. השרת משתמש בה כדי לוודא שרק מנהל יכול לאשר משתמשים
    with sqlite3.connect(DB_NAME) as conn:  # פותח חיבור למסד הנתונים וסוגר אותו אוטומטית בסוף הבלוק
        cursor = conn.cursor()  # יוצר סמן להרצת פקודות SQL
        cursor.execute("SELECT is_admin FROM users WHERE username = ?", (username,))  # שולף את שדה is_admin (1 או 0) של המשתמש עם השם הזה. הפסיק אחרי username נדרש כדי שזה ייחשב tuple
        row = cursor.fetchone()  # לוקח את השורה שנמצאה, או None אם המשתמש לא קיים
        return bool(row and row[0] == 1)  # מחזיר True רק אם המשתמש קיים (row לא ריק) והערך שלו הוא 1. בכל מקרה אחר מחזיר False

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
        # --- שונה: סדר עמודות מפורש (במקום SELECT *) כדי שהאינדקסים בצד הלקוח תמיד יהיו נכונים ---
        # מבנה כל שורה: [0]=id, [1]=player1, [2]=player2, [3]=winner, [4]=board_state, [5]=played_at
        # ORDER BY id DESC - המשחקים החדשים ביותר יופיעו למעלה בטבלה
        cursor.execute("SELECT id, player1, player2, winner, board_state, played_at FROM matches ORDER BY id DESC")
        matches = cursor.fetchall()
        return {"users": users, "matches": matches}

def admin_approve_user(username):
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET status = 'approved' WHERE username = ?", (username,))
        conn.commit()