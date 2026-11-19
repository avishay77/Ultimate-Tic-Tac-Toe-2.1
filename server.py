# -*- coding: utf-8 -*-
#ngrok http 5000
import os
from flask import Flask, request, jsonify, session  # שונה: נוסף session. זה מנגנון ששומר בשרת מידע על כל גולש (בעזרת עוגייה), ואנחנו צריכים אותו כדי לדעת מי מחובר כשמישהו מנסה לאשר משתמש
from flask_socketio import SocketIO, emit, join_room, leave_room  # שונה: נוסף leave_room לייבוא

# ייבוא קובץ ניהול מסד הנתונים בשם הנכון database.py
import database

app = Flask(__name__)
app.secret_key = 'change-this-secret-key'  # חדש: מפתח סודי ש-Flask משתמש בו כדי להצפין ולחתום על ה-session. בלעדיו session לא עובד. מומלץ להחליף את המחרוזת למשהו אקראי משלך
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0  # חדש: מבטל שמירת קבצי static במטמון של הדפדפן, כדי שתמיד ייטען index.js העדכני
socketio = SocketIO(app, cors_allowed_origins="*")

# אתחול מסד הנתונים דרך הקובץ החיצוני
database.init_db()

rooms = {}
player_rooms = {}
room_turns = {}
room_users = {}  # חדש: מילון sid -> שם המשתמש של השחקן (כדי שהשרת ידע מי שיחק)
saved_rooms = set()  # חדש: קבוצת חדרים שהמשחק שלהם כבר נשמר (מונע שמירה כפולה)
room_counter = 0  # חדש: מונה שרק עולה, כדי ששמות חדרים לא יתנגשו אחרי מחיקת חדר

@app.route('/')
def home():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    target_path = os.path.join(base_dir, 'index.html')
    with open(target_path, encoding='utf-8') as f:
        return f.read()

# --- נתיבי התחברות ורישום דרך database.py ---
@app.route('/login', methods=['POST'])  # מגדיר שהפונקציה למטה רצה כשהדפדפן שולח בקשת POST לכתובת /login
def login():  # פונקציית ההתחברות בשרת
    data = request.json  # קורא את גוף הבקשה שהגיעה מהדפדפן, שנשלח כ-JSON, והופך אותו למילון
    username = data.get('username')  # שולף מהמילון את שם המשתמש שהוקלד
    password = data.get('password')  # שולף מהמילון את הסיסמה שהוקלדה

    result = database.login_user(username, password)  # מעביר את הפרטים לפונקציה ב-database.py שבודקת אותם (כולל בדיקה שהמשתמש מאושר)

    if result["status"] == "success":  # אם ההתחברות הצליחה, כלומר הפרטים נכונים והמשתמש מאושר
        session['username'] = username  # חדש: שומר ב-session של הגולש את שם המשתמש שלו. כך בבקשות הבאות (למשל אישור משתמש) השרת יודע מי מחובר
        return jsonify({  # מחזיר לדפדפן תשובת JSON
            'status': 'success',  # מודיע שההתחברות הצליחה
            'username': username,  # מחזיר את שם המשתמש כדי שהדפדפן יציג אותו
            'user_status': result.get("user_status"),  # מחזיר את סטטוס המשתמש (כאן תמיד approved)
            'is_admin': result.get("is_admin")  # מחזיר 1 אם המשתמש מנהל ו-0 אם לא, כדי שהדפדפן יציג למנהל עמודות נוספות
        })  # סוף תשובת ההצלחה
    return jsonify({'status': 'error', 'message': result.get("message", "שם משתמש או סיסמה שגויים")}), 401  # אם הגענו לכאן ההתחברות נכשלה (פרטים שגויים או משתמש ממתין), אז מחזיר את הודעת השגיאה עם קוד 401 (לא מורשה)

@app.route('/register', methods=['POST'])  # מגדיר שהפונקציה למטה רצה על בקשת POST לכתובת /register
def register():  # פונקציית ההרשמה בשרת
    data = request.json  # קורא את ה-JSON שנשלח מהדפדפן
    username = data.get('username')  # שולף את שם המשתמש
    password = data.get('password')  # שולף את הסיסמה

    if not username or not password:  # אם שם המשתמש או הסיסמה ריקים
        return jsonify({'status': 'error', 'message': 'נא למלא שם משתמש וסיסמה'}), 400  # מחזיר שגיאה עם קוד 400 (בקשה לא תקינה)

    result = database.register_user(username, password)  # מבקש מ-database.py ליצור את המשתמש, והוא ייווצר במצב pending

    if result["status"] == "success":  # אם ההרשמה הצליחה
        return jsonify({'status': 'success', 'username': username,
                        'message': 'נרשמת בהצלחה! ממתין לאישור מנהל. בינתיים אפשר להיכנס כאורח'})  # שונה: מחזיר הצלחה עם הודעה שמסבירה שצריך לחכות לאישור מנהל. הדפדפן מציג אותה למשתמש
    return jsonify({'status': 'error', 'message': result.get("message", "שם המשתמש כבר תפוס")}), 400  # אם ההרשמה נכשלה (למשל שם תפוס), מחזיר את השגיאה עם קוד 400

@app.route('/approve_user', methods=['POST'])  # חדש: מגדיר נתיב חדש שהדפדפן קורא לו כשהמנהל לוחץ על Approve
def approve_user():  # חדש: פונקציית האישור בשרת
    current = session.get('username')  # חדש: שולף מה-session את שם המשתמש המחובר כרגע, או None אם אף אחד לא התחבר
    if not current or not database.is_user_admin(current):  # חדש: אם אף אחד לא מחובר, או שהמחובר אינו מנהל
        return jsonify({'status': 'error', 'message': 'Admins only'}), 403  # חדש: חוסם את הבקשה עם קוד 403 (אסור). הבדיקה נעשית בשרת ולא בדפדפן, כדי שאף אחד לא יוכל לעקוף אותה
    username = request.json.get('username')  # חדש: שולף מהבקשה את שם המשתמש שהמנהל רוצה לאשר
    database.admin_approve_user(username)  # חדש: קורא לפונקציה הקיימת ב-database.py ששמה את הסטטוס של המשתמש ל-approved
    return jsonify({'status': 'success'})  # חדש: מחזיר לדפדפן הצלחה, והדפדפן יטען מחדש את הטבלה

@app.route('/get_users', methods=['GET'])
def get_users():
    users_data = database.get_users_statistics()
    return jsonify(users_data)

@app.route('/get_history', methods=['GET'])
def get_history():
    data = database.admin_get_all_data()
    # data["matches"] מחזיר את כל המשחקים, כל שורה במבנה: (id, player1, player2, winner, board_state, played_at)
    # board_state הוא מחרוזת JSON עם רשימת המהלכים - הלקוח משחזר ממנה את הלוח
    return jsonify(data["matches"])

@app.route('/save_game', methods=['POST'])
def save_game():
    data = request.json
    player1 = data.get('player1', 'Guest')
    player2 = data.get('player2', 'Computer')
    winner = data.get('winner')
    board_state = data.get('board_state', '') # מקבל את מצב הלוח
    
    database.add_match(player1, player2, winner, board_state)
    return jsonify({'status': 'success'})

# --- SocketIO לניהול המשחק בזמן אמת ---

# חדש: פונקציית עזר שמוחקת חדר ומנקה את כל השחקנים שלו מכל המילונים
def remove_room(room_id):  # חדש: מקבלת את שם החדר למחיקה
    global rooms, player_rooms, room_turns, room_users, saved_rooms  # חדש: גישה למשתנים הגלובליים
    for sid in rooms.get(room_id, []):  # חדש: עוברת על כל השחקנים שהיו בחדר (שניהם, לא רק זה שיצא)
        player_rooms.pop(sid, None)  # חדש: מסירה את השחקן ממילון החדרים כדי שיוכל להצטרף שוב (בלי זה join_game היה נעצר בשורת ה-return)
        room_users.pop(sid, None)  # חדש: מוחקת את שם המשתמש ששמרנו עבורו
        leave_room(room_id, sid=sid)  # חדש: מוציאה את השחקן מחדר ה-SocketIO
    rooms.pop(room_id, None)  # חדש: מוחקת את החדר עצמו (אם כבר לא קיים - לא קורה כלום)
    room_turns.pop(room_id, None)  # חדש: מוחקת את מצב התור של החדר
    saved_rooms.discard(room_id)  # חדש: מנקה את סימון "נשמר" של החדר

@socketio.on('join_game')
def handle_join_game(data=None):  # שונה: מקבל עכשיו data מהלקוח (שם המשתמש), ברירת מחדל None כדי שלא ייפול אם לא נשלח
    global rooms, player_rooms, room_turns, room_counter  # שונה: נוסף room_counter
    if request.sid in player_rooms:
        return
    room_users[request.sid] = ((data or {}).get('username')) or 'Player'  # חדש: שומר את שם המשתמש של השחקן, או "Player" אם לא נשלח שם
    assigned_room = None
    for r_id, p_list in rooms.items():
        if len(p_list) == 1:
            assigned_room = r_id
            break
    if not assigned_room:
        room_counter += 1  # חדש: מקדם את המונה (שונה: במקום len(rooms)+1 שיכול להתנגש עם חדר קיים)
        assigned_room = f"room_{room_counter}"  # שונה: שם החדר נבנה מהמונה
        rooms[assigned_room] = []
        room_turns[assigned_room] = 0

    rooms[assigned_room].append(request.sid)
    player_rooms[request.sid] = assigned_room
    join_room(assigned_room)

    p_list = rooms[assigned_room]
    for index, sid in enumerate(p_list):
        player_num = index + 1
        is_my_turn = (index == room_turns[assigned_room])
        emit('init_player', {'player_num': player_num, 'is_my_turn': is_my_turn}, room=sid)

@socketio.on('disconnect')
def handle_disconnect():
    global rooms, player_rooms, room_turns
    user_room = player_rooms.get(request.sid)
    if user_room and user_room in rooms:
        remove_room(user_room)  # שונה: במקום מחיקה ידנית - משתמש בפונקציית העזר שמנקה גם את היריב
    player_rooms.pop(request.sid, None)  # שונה: מוחק בבטחה גם אם כבר נמחק
    room_users.pop(request.sid, None)  # חדש: מוחק את שם המשתמש של מי שהתנתק

# חדש: הלקוח שולח את זה כשחוזרים למסך הראשי (back / restart), כדי שיוכלו להתחיל משחק אונליין חדש
@socketio.on('leave_game')
def handle_leave_game():  # חדש: ללא פרמטרים, השרת יודע מי שלח לפי request.sid
    user_room = player_rooms.get(request.sid)  # חדש: מחפש באיזה חדר השחקן נמצא
    if user_room:  # חדש: אם השחקן לא בחדר (למשל חזר מטבלה) - לא עושים כלום
        remove_room(user_room)  # חדש: מוחק את החדר ומנקה את שני השחקנים

# חדש: הלקוח שולח את זה כשמישהו ניצח במשחק אונליין. השרת שומר את המשחק בעצמו, פעם אחת בלבד
@socketio.on('game_over')
def handle_game_over(data):  # חדש: data מכיל winner_num (1 או -1/2) ו-board_state
    user_room = player_rooms.get(request.sid)  # חדש: החדר של השולח
    if not user_room or user_room not in rooms:  # חדש: אם אין חדר תקין - יוצא
        return  # חדש: לא שומרים משחק בלי חדר
    if user_room in saved_rooms:  # חדש: שני הדפדפנים שולחים את האירוע, אז המשחק כבר נשמר?
        return  # חדש: אם כן - יוצא כדי לא לשמור פעמיים
    p_list = rooms[user_room]  # חדש: רשימת ה-sid של שני השחקנים בחדר
    if len(p_list) < 2:  # חדש: משחק אונליין דורש שני שחקנים
        return  # חדש: אחרת לא שומרים
    player1 = room_users.get(p_list[0], 'Player 1')  # חדש: שם שחקן 1 (איקס, הראשון בחדר)
    player2 = room_users.get(p_list[1], 'Player 2')  # חדש: שם שחקן 2 (עיגול, השני בחדר)
    winner = player1 if data.get('winner_num') == 1 else player2  # חדש: 1 = איקס = שחקן 1, כל ערך אחר = שחקן 2
    saved_rooms.add(user_room)  # חדש: מסמן שהחדר נשמר, לפני השמירה כדי למנוע race בין שני הדפדפנים
    database.add_match(player1, player2, winner, data.get('board_state', ''))  # חדש: שומר במסד הנתונים עם שני השמות האמיתיים

@socketio.on('send_move')
def handle_move(data):
    global room_turns, rooms, player_rooms
    user_room = player_rooms.get(request.sid)
    if not user_room or user_room not in rooms:
        return
    p_list = rooms[user_room]
    if len(p_list) < 2:
        return
    current_turn = room_turns[user_room]
    if p_list[current_turn] == request.sid:
        room_turns[user_room] = (current_turn + 1) % len(p_list)
        next_turn = room_turns[user_room]
        for index, sid in enumerate(p_list):
            emit('apply_remote_move', {'button_id': data.get('button_id'), 'is_my_turn': (index == next_turn)}, room=sid)

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', debug=True, port=5000)