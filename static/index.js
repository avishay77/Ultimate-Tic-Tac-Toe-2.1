// מאתחל את ה-Socket ומחבר את הדפדפן לשרת המשחק
const socket = io();
let myPlayerNum = 0;
let isMyTurn = false;
let vsComputer = true; // ברירת מחדל: משחק מול מחשב כדי שהכפתורים יעבדו תמיד
let isOnline = false;

socket.on('init_player', function (data) { // מקבל מהשרת את מספר השחקן והאם תורו
    myPlayerNum = data.player_num;
    isMyTurn = data.is_my_turn;
});

socket.on('apply_remote_move', function (data) { // מקבל מהשרת את הלחיצה שבוצעה, תור מי ושומר את זה
    isMyTurn = data.is_my_turn;

    // עדכון טקסט תור השחקן
    const torElem = document.getElementById("tor");
    if (torElem) {
        torElem.innerHTML = isMyTurn ? "It's your turn" : "It's not your turn";
    }

    const btn = document.getElementById(data.button_id); // שומר את הכפתור שנלחץ
    if (btn && typeof executeMove === "function") {
        executeMove(btn); // מריץ את הפונקציה לבקשת המהלך
    }
});

// פונקציה לבחירת משחק מול המחשב
function selectCpuMode() {
    vsComputer = true;
    isOnline = false;

    // עדכון קלאסים ועיצוב הכפתורים הראשיים
    const btnCpu = document.getElementById("btn-vs-cpu");
    const btn1v1 = document.getElementById("btn-1v1");

    if (btnCpu && btn1v1) {
        btnCpu.classList.add("active-mode");
        btn1v1.classList.remove("active-mode");
    }

    // הסתרת תפריט המשנה של 1v1
    const subMenu = document.getElementById("sub-menu-1v1");
    if (subMenu) {
        subMenu.style.display = "none";
    }
}

// פונקציה לבחירת משחק 1v1 (פתיחת תפריט המשנה ושינוי עיצוב)
function toggle1v1SubMenu() {
    vsComputer = false;

    // עדכון עיצוב הכפתורים הראשיים
    const btnCpu = document.getElementById("btn-vs-cpu");
    const btn1v1 = document.getElementById("btn-1v1");

    if (btnCpu && btn1v1) {
        btn1v1.classList.add("active-mode");
        btnCpu.classList.remove("active-mode");
    }

    // הצגת תפריט המשנה
    const subMenu = document.getElementById("sub-menu-1v1");
    if (subMenu) {
        subMenu.style.display = "flex";
        set1v1Mode('online'); // ברירת מחדל בתוך ה-1v1: אונליין מסומן
    }
}

// פונקציה לקביעת סוג משחק ה-1v1 (אונליין או מקומי)
function set1v1Mode(mode) {
    const btnOnline = document.getElementById("btn-online");
    const btnLocal = document.getElementById("btn-local");

    if (mode === 'online') {
        isOnline = true; // עדכון מצב אונליין

        if (btnOnline && btnLocal) {
            btnOnline.classList.add("active-mode");
            btnLocal.classList.remove("active-mode");
        }

        // שליחת איתות לשרת: "השחקן לחץ אונליין, שבץ אותו לחדר!"
        socket.emit('join_game', { username: currentUser }); // שונה: שולח לשרת גם את שם המשתמש, כדי שהשרת ידע מי שיחק כשהוא שומר את המשחק

    } else {
        isOnline = false; // עדכון מצב מקומי

        if (btnOnline && btnLocal) {
            btnLocal.classList.add("active-mode");
            btnOnline.classList.remove("active-mode");
        }
    }
}
// עדכון פונקציית בלחיצה על הלוח (jow)
function jow(t) {
    if (win == 0) {
        // משחק אונליין ברשת דרך השרת
        if (!vsComputer && isOnline) {
            if (!isMyTurn) {
                error();
                return;
            }
            socket.emit('send_move', { button_id: t.id }); //שולח לשרת את הכפתור שנלחץ עליו
            return;
        }

        // משחק 1v1 מקומי באותו המחשב או מול המחשב
        executeMove(t);
    }
}
function executeMove(t) {
    if (win == 0) { // מקבל כפתור שנלחץ רק אם המשחק עדיין לא נגמר

        // חישוב המיקום המדויק של המשבצת במערך הדו-ממדי הגדול (0 עד 8)
        let col = Math.floor((t.id % 27) / 9) * 3 + t.id % 3; // מחשב מספר עמודה במערך
        let row = Math.floor(t.id / 27) * 3 + Math.floor((t.id % 9) / 3); // מחשב מספר שורה במערך
        let c = t.id % 3; // מחשב עמודה מקומית (0, 1, 2) בתוך הלוח הקטן
        let r = Math.floor(t.id % 9 / 3); // מחשב שורה מקומית (0, 1, 2) בתוך הלוח הקטן

        if (arrsmall[row][col] == 0) { // בודק שהמשבצת הזו ריקה (ערך 0)

            if (vsComputer) {
                // --- מצב: משחק מול המחשב ---
                tor++; // מקדם את מניות התורים
                //מציב את תמונות השחקן במקום הכפתור
                t.outerHTML = `<img src="${picx}" class="pic_players">`;
                arrsmall[row][col] = 1; // רושם 1 במערך (תפוס ע"י שחקן 1)

                tds = r * 10 + c; // מחשב לאיזה לוח קטן התור הזה שולח את היריב
                winTeko(arrsmall, row, col, t.id); // בודק אם המהלך הזה הביא לניצחון/תיקו בלוח הקטן או הגדול

                if (win == 0) { // אם המשחק לא הסתיים במהלך של השחקן
                    let best_move;
                    // שונה: שומר את מזהה ה-timeout ב-botTimer, כדי ש-resetGame תוכל לבטל מהלך מחשב שעדיין "חושב"
                    botTimer = setTimeout(() => { // ממתין 800 מילישניות כדי לתת תחושה שהמחשב "חורש/חושב"
                        best_move = get_best_move(); // מפעיל אלגוריתם Minimax שמחזיר את המהלך הטוב ביותר

                        let rr = Math.floor(best_move / 10); // מפתח שורה של תור המחשב
                        let cc = best_move % 10; // מפתח עמודה של תור המחשב
                        arrsmall[rr][cc] = 2; // רושם 2 במערך (תפוס ע"י המחשב)

                        // מחשב בחזרה את ה-ID של הכפתור ב-HTML מתוך השורה והעמודה
                        t_id = Math.floor(rr / 3) * 27 + Math.floor(cc / 3) * 9 + (rr % 3) * 3 + (cc % 3);

                        let rrr = Math.floor(t_id % 9 / 3); // שורה מקומית של מהלך המחשב
                        let ccc = t_id % 3; // עמודה מקומית של מהלך המחשב
                        tds = rrr * 10 + ccc; // מחשב לאיזה לוח המחשב שולח בחזרה את השחקן

                        //מציב את תמונות השחקן במקום הכפתור
                        document.getElementById(t_id).outerHTML = `<img src="${pico}" class="pic_players">`;

                        winTeko(arrsmall, rr, cc, t_id); // בודק אם המחשב ניצח/עשה תיקו

                        // בדיקת 3 במקום eedf: בודק אם התא הראשון בלוח שהמחשב שלח אליו מכיל 3 (כלומר הלוח סגור)
                        if (arrsmall[rrr * 3][ccc * 3] == 3) {
                            tds = 100; // פותח את המשחק לכל הלוחות
                        }

                        light(); // מדגיש את הלוח/הלוחות המותרים
                    }, 800);
                }
            } else {
                // --- מצב: משחק שחקן מול שחקן (1v1) ---
                t_id = t.id; // שומר את מזהה הכפתור הנלחץ

                if (tor % 2 != 0) { // אם מספר התור אי-זוגי -> תור שחקן 1 (איקס)
                    //שים תמונה של איקס
                    t.outerHTML = `<img src="${picx}" class="pic_players">`;
                    arrsmall[row][col] = 1; // סמן במערך 1
                    // מעדכן את התצוגה בצד שבתור הבא ישחק שחקן 2 (עיגול)
                    if (!isOnline)
                        //מעדכן תור מי
                        document.getElementById("tor").innerHTML = `The turn of:<br /><img class='skin' src='${pico}' class='pic_tor' />`;
                } else { // אם מספר התור זוגי -> תור שחקן 2 (עיגול)
                    //שים תמונה של עיגול
                    t.outerHTML = `<img src="${pico}"  class="pic_players">`;
                    arrsmall[row][col] = 2; // סמן במערך 2
                    // מעדכן את התצוגה בצד שבתור הבא ישחק שחקן 1 (איקס)
                    if (!isOnline)
                        //מעדכן תור מי
                        document.getElementById("tor").innerHTML = `The turn of:<br /><img class='skin' src='${picx}' class='pic_tor' />`;
                }

                winTeko(arrsmall, row, col, t.id); // בודק ניצחון או תיקו בלוח הקטן/הגדול

                tds = r * 10 + c; // מחשב את קוד הלוח שאליו נשלח השחקן הבא
                // בדיקת 3 במקום eedf: בודק אם התא הראשון בלוח שאליו נשלח השחקן מכיל 3 (הלוח תפוס/גמור)
                if (arrsmall[r * 3][c * 3] == 3) {
                    tds = 100; // אם כן, מאפשר לשחק בכל הלוחות בסיבוב הבא
                }

                light(); // מדגיש את הלוח/הלוחות המותרים
                tor++; // מקדם את מונה התורים ב-1
            }
        }
    }
}
let xxx = 5; //לכמה עומק בודקים
let botTimer = null; // חדש: מזהה ה-timeout של מהלך המחשב (כדי שאפשר יהיה לבטל אותו באיפוס)
/*מערך דן ממדי על כל כפתור*/
const arrsmall = new Array(9); /*מערך חד ממדי בגודל 9*/
for (let i = 0; i < arrsmall.length; i++) { /*לולאה כמספר האיברים במערך החד ממדי 9*/
    arrsmall[i] = new Array(9) /*מציב בכל איבר במערך החד ממדי מערך חד ממדי בגודל 9*/
    for (let s = 0; s < arrsmall[i].length; s++) /*לולאה כמספר האיברים במערך החד ממדי שבתוך החד ממדי 9*/
        arrsmall[i][s] = 0; /*מציב שם 0*/
}
const arrbig = new Array(3); /*מערך חד ממדי בגודל 3*/
for (let i = 0; i < arrbig.length; i++) { /*לולאה כמספר האיברים במערך החד ממדי 3*/
    arrbig[i] = new Array(3) /*מציב בכל איבר במערך החד ממדי מערך חד ממדי בגודל 3*/
    for (let s = 0; s < arrbig[i].length; s++) /*לולאה כמספר האיברים במערך החד ממדי שבתוך החד ממדי 3*/
        arrbig[i][s] = 0; /*מציב שם 0*/
}
let tor = 1; /*משתנה שמגלה תור מי*/
let moveHistory = []; // חדש: רשימת כל המהלכים במשחק הנוכחי, כל מהלך הוא {id: מספר הכפתור, p: 1 או 2}
let tds = 100; /*משתנה שמגלה לאיזה כפתורים לאפשר לפעול 100 מאפשר לכולם*/
let win = 0; /*משתנה שאומר אם יש ניצחון או לא*/

let picx;
let pico;

//איזה כפתורים כל כפתור מדגיש
const buttonMapping = {
    0: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    1: [9, 10, 11, 12, 13, 14, 15, 16, 17],
    2: [18, 19, 20, 21, 22, 23, 24, 25, 26],
    3: [27, 28, 29, 30, 31, 32, 33, 34, 35],
    4: [36, 37, 38, 39, 40, 41, 42, 43, 44],
    5: [45, 46, 47, 48, 49, 50, 51, 52, 53],
    6: [54, 55, 56, 57, 58, 59, 60, 61, 62],
    7: [63, 64, 65, 66, 67, 68, 69, 70, 71],
    8: [72, 73, 74, 75, 76, 77, 78, 79, 80],
};
let highlightedButtons = []; // מערך לשמירת הכפתורים המודגשים

// שונה: הפונקציה בונה עכשיו את הלוח באותו עיצוב כמו תצוגת ההיסטוריה (div-ים עם אותן מחלקות CSS)
// במקום טבלת <table>. היא גם מציגה את כפתור חזור כשהמשחק מתחיל.
function f() {
    let s = ""; // מחרוזת ה-HTML של הלוח
    let idnum = 0; // מספר הכפתור הנוכחי (0 עד 80)

    // הלוח הגדול: רשת של 3x3 לוחות קטנים (אותן מחלקות כמו תצוגת ההיסטוריה)
    s += "<div class='viewer-big game-big'>";
    for (let ew = 0; ew < 9; ew++) { // ew = מספר הלוח הקטן (0 עד 8), וגם מספר הפונקציה cr שתופעל בלחיצה
        // הלוח הקטן. ה-id נשאר "מספר.1" כמו קודם, כי winTeko משתמשת בו כדי להוסיף את שכבת הניצחון
        s += "<div id='" + ew + ".1' class='viewer-small game-small'>";
        for (let k = 0; k < 9; k++) { // 9 תאים בכל לוח קטן
            s += "<div class='viewer-cell'>"; // התא (הרקע הכחול)
            s += "<button id='" + idnum + "' class='qwerty' onclick='cr" + ew + "(this);'></button>"; // הכפתור בתוך התא
            s += "</div>";
            idnum++;
        }
        s += "</div>";
    }
    s += "</div>";

    document.getElementById("play").innerHTML = s; /*מציב את הלוח במקום בחירת הסקין*/

    // מעלים את אזור בחירת מצב המשחק
    document.getElementById("mode-selector").innerHTML = "";
    setVisible("table-buttons", false);
    //document.getElementById("table-buttons").innerHTML = "";
    //מכניס אותו לחדר
    if (!vsComputer && isOnline)
        socket.emit('join_game', { username: currentUser }); // שונה: שולח גם את שם המשתמש (השרת ממילא מתעלם אם השחקן כבר בחדר)
    // מפעיל את מחוון התורים רק אם זה מצב 1 נגד 1
    if (!vsComputer && !isOnline) {
        document.getElementById("tor").innerHTML = `The turn of:<br /><img class='skin' src='${picx}' class='pic_tor' />`;
    }

    // חדש: המשחק התחיל, אז מציגים את כפתור חזור (במסך ההתחלתי הוא מוסתר)
    setVisible("back-btn", true);
}

let t_id;

function light() {
    // מחזיר את כל הכפתורים בלוח למראה הרגיל הכהה שלהם
    for (let qq = 0; qq < 9; qq++) {
        for (let q = 0; q < 9; q++) {
            let btn = document.getElementById(buttonMapping[qq][q]);
            if (btn != null) {
                btn.style.boxshadow = "none"; // מבטל את הצל
                btn.style.filter = "brightness(1)"; // מחזיר בהירות רגילה
            }
        }
    }
    if (win == 0) { // מפעיל את ההדגשות רק אם המשחק עדיין פעיל (אין ניצחון סופי)

        if (tds == 100) { // אם tds שווה 100, המשמעות היא שמותר לשחק בכל הלוחות
            for (let qq = 0; qq < 9; qq++) { // עובר על 9 הלוחות
                for (let q = 0; q < 9; q++) { // עובר על 9 הכפתורים בכל לוח
                    let btn = document.getElementById(buttonMapping[qq][q]);
                    // שונה: מדגיש רק כפתור שעדיין פתוח למשחק (isCellOpen).
                    // כפתורים שנשארו מתחת לשכבת ניצחון של לוח קטן שנוצח לא מודגשים
                    if (btn != null && isCellOpen(buttonMapping[qq][q])) {
                        btn.style.boxshadow = "0 0 15px #ff4500"; // צובע בצל מואר
                        btn.style.filter = "brightness(3)"; // מעלה את הבהירות
                    }
                }
            }
        }
        if (tds != 100) { // בודק אם התבצעה לחיצה תקינה ויש לוח ספציפי לשחק בו
            // מוצא את קבוצת הכפתורים של הלוח הספציפי שאליו נשלח השחקן ומדגיש רק אותם
            const relatedbuttons = buttonMapping[t_id % 9]; // משיג את המערך של 9 הכפתורים המיועדים
            for (let i = 0; i < relatedbuttons.length; i++) {
                let ttt = relatedbuttons[i]; // מזהה הכפתור הבודד
                let btn = document.getElementById(ttt); // תפסת הכפתור מה-DOM
                if (btn && isCellOpen(ttt)) { // שונה: גם כאן מדגיש רק כפתור שפתוח למשחק
                    btn.style.boxshadow = "0 0 15px #ff4500"; // מדגיש בצל מואר
                    btn.style.filter = "brightness(3)"; // מעלה בהירות
                }
            }
        }
    }
}

// חדש: בודק אם התא עם ה-id הזה עדיין פתוח למשחק (ריק, והלוח הקטן שלו לא נוצח/נסגר).
// צריך את זה כי עכשיו כשלוח קטן נוצח, הכפתורים שלו נשארים מתחת לשכבת הניצחון (כדי שאפשר יהיה
// לראות אותם בהובר), ואסור להדגיש אותם.
function isCellOpen(id) {
    let row = Math.floor(id / 27) * 3 + Math.floor((id % 9) / 3); // אותו חישוב שורה כמו ב-executeMove
    let col = Math.floor((id % 27) / 9) * 3 + id % 3; // אותו חישוב עמודה כמו ב-executeMove
    return arrsmall[row][col] == 0; // 0 = ריק. (3 = לוח סגור, 1/2 = תפוס)
}
function winTeko(arrsmall, row, col, t) {
    // חדש: רושם כל מהלך ברשימת המהלכים. הפונקציה הזו נקראת פעם אחת בכל מהלך (בכל מצבי המשחק),
    // ולכן זה המקום הכי נוח לתעד. השחקן (1 = איקס, 2 = עיגול) נלקח מהמערך,
    // כי המהלך כבר נרשם בו לפני הקריאה לפונקציה. חייבים לעשות את זה לפני שהלוח הקטן הופך ל-3.
    moveHistory.push({ id: Number(t), p: arrsmall[row][col] });

    let winsmalll = winsmall(arrsmall, row, col)
    if (winsmalll != 0) {
        /*אם יש ניצחון בבשורות או בעמודות או באחד האלכסונים אז*/
        let colss = Math.floor(col / 3) + Math.floor(row / 3) * 3; /*מגלה את האי די של המקום שנוצח*/
        let rrrr = Math.floor(t / 9 / 3); /*מגלה את המיקום שלו במשתנה הגדול*/
        let cccc = Math.floor(t / 9) % 3; /*מגלה את המיקום שלו במשתנה הגדול*/

        // שונה: במקום להחליף את כל תוכן הלוח הקטן בתמונה (מה שמוחק את מה שהיה בו),
        // מוסיפים מעליו "שכבת ניצחון" עם האיקס/עיגול הגדול - בדיוק כמו בתצוגת ההיסטוריה (showGameBoard).
        // התאים נשארים מתחת לשכבה, וה-CSS (.viewer-overlay:hover) מעלים אותה כשהעכבר עליה,
        // ואז רואים מה היה בלוח הקטן לפני הניצחון.
        const winnerSkin = (winsmalll == 1) ? picx : pico; /*איזו תמונה מייצגת את המנצח בלוח הקטן*/
        arrbig[rrrr][cccc] = (winsmalll == 1) ? 1 : 2; /*מציב במשתנה הדו ממדי הגדול (1 = איקס, 2 = עיגול)*/
        const overlay = document.createElement("div"); // יוצר את שכבת הניצחון
        overlay.className = "viewer-overlay"; // אותה מחלקה כמו בתצוגת ההיסטוריה (כולל אפקט ההובר)
        overlay.appendChild(makeImg(winnerSkin, "viewer-mark")); // שם בתוכה את האיקס/עיגול הגדול
        document.getElementById(`${colss}.1`).appendChild(overlay); // מוסיף אותה מעל הלוח הקטן שנוצח

        let c = t % 3; /*מגלה את מספר העמודה של הכפתור ביחס ל 9 הכפתורים*/
        let r = Math.floor(t % 9 / 3); /*מגלה את מספר השורה של הכפתור ביחס ל 9 הכפתורים*/
        for (let dotr = row - row % 3; dotr < row - row % 3 + 3; dotr++) { /*מגלה את ההתחלה של העמודה ביחס ל9 כפתורים*/
            for (let dotc = col - col % 3; dotc < col - col % 3 + 3; dotc++) { /*מגלה את ההתחלה של העמודה ביחס ל9 כפתורים*/
                arrsmall[dotr][dotc] = 3;
            }
        }
        let win_big = winbig(arrbig);
        if (win_big != 0) { /*אם יש ניצחון גדול*/
            win = 1; /*תעדכן את המחשב שיש ניצחון כדי שהכפתורים לא יעבדו*/
            //document.getElementById("win").style.backgroundColor = "yellow"
            document.getElementById("www").innerHTML = "win";

            // קביעת שם המנצח לשמירה ב-DB (שחקן 1 או bot)
            let winnerName = (win_big == 1) ? (currentUser || "Player 1") : (vsComputer ? "bot" : "Player 2");
            recordGameResult(winnerName, win_big); // שונה: מעביר גם את win_big (1 או -1), כדי שבמשחק אונליין נשלח לשרת מי ניצח

            for (let gf = 0; gf < 10; gf++) {//קונפטי
                confetti();
                setTimeout(() => {
                    confetti();
                    //clearInterval(int);
                }, 2000);
            }
            if (win_big == 1)
                document.getElementById("win").style.backgroundImage = `url('${picx}')`
            else
                document.getElementById("win").style.backgroundImage = `url('${pico}')`

            // מחזיר את כל הכפתורים בלוח למראה הרגיל הכהה שלהם
            for (let qq = 0; qq < 9; qq++) {
                for (let q = 0; q < 9; q++) {
                    if (document.getElementById(buttonMapping[qq][q]) != null) {
                        document.getElementById(buttonMapping[qq][q]).style.boxshadow = "none"; // מבטל את הצל
                        document.getElementById(buttonMapping[qq][q]).style.filter = "brightness(1)"; // מחזיר בהירות רגילה
                        document.getElementById(buttonMapping[qq][q]).style.zindex = "0"; // מחזיר שכבה רגילה
                    }
                }
            }
            document.getElementById("tor").innerHTML = ``;


            // --- הוספת השורות הללו: המתנה של 3 שניות (3000ms) והצגת כפתור הריסטרט ---
            setTimeout(() => {
                showRestartButton();
            }, 3000);
        }

    }
    else {
        // בודק אם הלוח הקטן הסתיים בתיקו (אין מקומות פנויים ואין מנצח)
        if (tekosmall(row, col) == 1) {
            //let colss = Math.floor(col / 3) + Math.floor(row / 3) * 3; // מחשב את המזהה (ID) של הלוח הקטן


            // לולאה כפולה שעוברת על כל 9 המשבצות של הלוח הקטן שכרגע הסתיים בתיקו
            for (let dotr = row - row % 3; dotr < row - row % 3 + 3; dotr++) {
                for (let dotc = col - col % 3; dotc < col - col % 3 + 3; dotc++) {
                    arrsmall[dotr][dotc] = 3; // משנה את הערך במערך ל-3 כדי לסמן שהלוח הזה מבוטל/סגור
                }
            }
        }
    }
}
function winsmall(arr, r, c) {
    let winn = 0;
    let dotc = c - c % 3; /*מגלה את ההתחלה של העמודה ביחס ל9 כפתורים*/
    let dotr = r - r % 3; /*מגלה את ההתחלה של העמודה ביחס ל9 כפתורים*/
    if (arr[dotr][c] != 0 && arr[dotr][c] == arr[dotr + 1][c] && arr[dotr][c] == arr[dotr + 2][c])
        winn = arr[dotr][c]
    if (arr[r][dotc] != 0 && arr[r][dotc] == arr[r][dotc + 1] && arr[r][dotc] == arr[r][dotc + 2])
        winn = arr[r][dotc]
    if (arr[dotr][dotc] != 0 && arr[dotr][dotc] == arr[dotr + 1][dotc + 1] && arr[dotr][dotc] == arr[dotr + 2][dotc + 2])
        winn = arr[dotr][dotc]
    if (arr[dotr + 2][dotc] != 0 && arr[dotr + 2][dotc] == arr[dotr + 1][dotc + 1] && arr[dotr + 2][dotc] == arr[dotr][dotc + 2])
        winn = arr[dotr + 2][dotc];
    if (winn == 2)
        return -1;
    if (winn == 1)
        return 1;
    return 0;
}
function winbig(arrb) {
    let winn = 0;
    for (let r = 0; r < 3; r++) {
        if (arrb[r][0] != 0 && arrb[r][0] == arrb[r][1] && arrb[r][0] == arrb[r][2])
            winn = arrb[r][0];
    }
    for (let c = 0; c < 3; c++) {
        if (arrbig[0][c] != 0 && arrb[0][c] == arrb[1][c] && arrb[0][c] == arrb[2][c])
            winn = arrb[0][c];
    }
    if (arrbig[0][0] != 0 && arrb[0][0] == arrb[1][1] && arrb[0][0] == arrb[2][2])
        winn = arrb[0][0];
    if (arrbig[0][2] != 0 && arrb[0][2] == arrb[1][1] && arrb[0][2] == arrb[2][0])
        winn = arrb[0][2];
    if (winn == 2)
        return -1;
    if (winn == 1)
        return 1;
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            if (arrbig[i][j] == 0) return 0;
        }
    }
    return 0;
    //אם מגיע לכאן יש תיקו גדול
    //return 2;
}
function tekosmall(r, c) {
    rdot = r - r % 3;
    cdot = c - c % 3;
    for (let i = 0; i < 3; i++) {
        for (let l = 0; l < 3; l++) {
            if (arrsmall[rdot + i][cdot + l] == 0)
                return 0;
        }
    }
    return 1;
}
{
    function cr0(t) { /*פונקציה של כשלוחצים על הכפתורים בהתאמה ומקבלת את הכפתור*/
        if (tds == 0 || tds == 100) /*אם התי די אס מוגדר לה או לכולם*/
            jow(t) /*אז לעבור לפונקציה גו' ולהעביר את הכפתור*/
        else error()
    }
    function cr1(t) {/*פונקציה של כשלוחצים על הכפתורים בהתאמה ומקבלת את הכפתור*/
        if (tds == 1 || tds == 100)  /*אם התי די אס מוגדר לה או לכולם*/
            jow(t) /*אז לעבור לפונקציה גו' ולהעביר את הכפתור*/
        else error()
    }
    function cr2(t) {/*פונקציה של כשלוחצים על הכפתורים בהתאמה ומקבלת את הכפתור*/
        if (tds == 2 || tds == 100)  /*אם התי די אס מוגדר לה או לכולם*/
            jow(t) /*אז לעבור לפונקציה גו' ולהעביר את הכפתור*/
        else error()
    }
    function cr3(t) {/*פונקציה של כשלוחצים על הכפתורים בהתאמה ומקבלת את הכפתור*/
        if (tds == 10 || tds == 100) /*אם התי די אס מוגדר לה או לכולם*/
            jow(t) /*אז לעבור לפונקציה גו' ולהעביר את הכפתור*/
        else error()
    }
    function cr4(t) {/*פונקציה של כשלוחצים על הכפתורים בהתאמה ומקבלת את הכפתור*/
        if (tds == 11 || tds == 100) /*אם התי די אס מוגדר לה או לכולם*/
            jow(t) /*אז לעבור לפונקציה גו' ולהעביר את הכפתור*/
        else error()
    }
    function cr5(t) {/*פונקציה של כשלוחצים על הכפתורים בהתאמה ומקבלת את הכפתור*/
        if (tds == 12 || tds == 100) /*אם התי די אס מוגדר לה או לכולם*/
            jow(t) /*אז לעבור לפונקציה גו' ולהעביר את הכפתור*/
        else error()
    }
    function cr6(t) {/*פונקציה של כשלוחצים על הכפתורים בהתאמה ומקבלת את הכפתור*/
        if (tds == 20 || tds == 100) /*אם התי די אס מוגדר לה או לכולם*/
            jow(t) /*אז לעבור לפונקציה גו' ולהעביר את הכפתור*/
        else error()
    }
    function cr7(t) {/*פונקציה של כשלוחצים על הכפתורים בהתאמה ומקבלת את הכפתור*/
        if (tds == 21 || tds == 100) /*אם התי די אס מוגדר לה או לכולם*/
            jow(t) /*אז לעבור לפונקציה גו' ולהעביר את הכפתור*/
        else error()
    }
    function cr8(t) {/*פונקציה של כשלוחצים על הכפתורים בהתאמה ומקבלת את הכפתור*/
        if (tds == 22 || tds == 100) /*אם התי די אס מוגדר לה או לכולם*/
            jow(t) /*אז לעבור לפונקציה גו' ולהעביר את הכפתור*/
        else
            error()

    }
}
function error() {
    document.getElementById("error").innerHTML = "ERROR"
    setTimeout(() => {
        document.getElementById("error").innerHTML = ""
    }, 2000);
}

function basc() {
    pico = "static/pic to xo fut.webp";
    picx = "static/pic to xo basc.webp";
    f();
}
function xo() {
    pico = "static/pic to xo o.webp";
    picx = "static/pic to xo x.webp";
    f();
}
let jh = 0;
function bodi() {
    jh = 1;
}
function tomjery() {
    pico = "static/pic to xo tom.png"
    picx = "static/pic to xo jery.png"
    f();
}
function namer() {
    if (jh == 1) {
        pico = "static/pic to xo roni.png";
        picx = "static/pic to xo arnold.png";
    } else {
        pico = "static/pic to xo siv.png";
        picx = "static/pic to xo namer.png";
    }
    f();
}
function get_best_move() {
    jl = 0 //מאפס את הבדיקה לעומק
    let tdt = tds; //שומר את ה TDS
    let best_score = Infinity; //שומר את הסכום הכי גרוע שיכול להיות כדי שכל דבר יהיה יותר טוב
    let best_index = -1; //למקרה שלא נמצא יותר טוב מחזיר -1
    let tdtf = tdt % 10; //מגלה לאיזה שורה בלוח הגדול שלחו אותו
    let tdta = Math.floor(tdt / 10); //מגלה לאיזה עמודה בלוח הגדול שלחו אותו
    let ii = tdta * 3; //מכפיל ב 3 כדי שיהיה ללוח הקטן
    let dd = tdtf * 3; //מכפיל ב 3 כדי שיהיה ללוח הקטן
    let iii = ii + 3; //מוסיף 3 כדי לחשב את קצה הלוח הקטן
    let ddd = dd + 3; //מוסיף 3 כדי לחשב את קצה הלוח הקטן
    if (arrbig[tdta][tdtf] != 0 || tdt == 100) { //אם המקום ששלחו אליו נוצח אז עושה שיעברו על כל הלוח
        ii = 0;
        dd = 0;
        iii = 9;
        ddd = 9;
    }


    for (let i = ii; i < iii; i++) { //לולאה של איפה אפשר לשים
        for (let d = dd; d < ddd; d++) { //לולאה של איפה אפשר לשים
            let smallRow = Math.floor(i / 3); //מגלה שורה בלוח הגדול
            let smallCol = Math.floor(d / 3); //מגלה עמודה בלוח הגדול
            if (arrsmall[i][d] == 0 && arrbig[smallRow][smallCol] == 0) { //אם לא ניצחו במקום הזה ולא שמו בוא עדיין אז:
                let tid = Math.floor(i / 3) * 27 + Math.floor(d / 3) * 9 + i % 3 * 3 + d % 3; //מגלה את ה ID של המקום
                let c = tid % 3;
                let r = Math.floor(tid % 9 / 3);
                tdt = r * 10 + c; //מגלה את ה TDT החדש
                const temp_board = arrsmall.map(row => [...row]); //מעתיק את הלוח הקטן
                const temp_board_big = arrbig.map(row => [...row]); //מעתיק את הלוח הגדול
                temp_board[i][d] = 2; //מציב במקום 2
                if_win_small_minmax(temp_board, temp_board_big, i, d); // שולח לפונקציה שבודקת עם יש ניצחון ואם כן משנה בהתאם
                const move_score = minmax(temp_board, 1, tdt, temp_board_big, jl + 1, -Infinity, Infinity);  // קורא לפונקציה מינמקס עם אלפא וביטא אינסוף ומינוס אינסוף ו ji+1
                if (move_score < best_score) { //אם פה זה יותר טוב
                    best_score = move_score; //שומר את הסכות היותתר טוב
                    best_index = i * 10 + d; //שומר את השורה והעמודה של המקום הכי טוב עד עכשיו
                }
            }
        }
    }

    return best_index; //מחזיר
}
let jl = 0;
function minmax(board, player, tds, boardbig, ji, alpha = -Infinity, beta = Infinity) {
    //if (ji > xxx || winbig(boardbig) != 0) return evaluateBoard(board, boardbig); // אם בדקו מספיק עמוק מחזיר את הסכום
    if (ji > xxx || winbig(boardbig) != 0) return scarm(board, boardbig); // אם בדקו מספיק עמוק מחזיר את הסכום


    let tdt = tds; //שומר את ה TDS
    let tdtf = tdt % 10; //מגלה לאיזה שורה בלוח הגדול שלחו אותו
    let tdta = Math.floor(tdt / 10); //מגלה לאיזה עמודה בלוח הגדול שלחו אותו
    let dd = tdtf * 3; //מכפיל ב 3 כדי שיהיה ללוח הקטן
    let ii = tdta * 3; //מכפיל ב 3 כדי שיהיה ללוח הקטן
    let iii = ii + 3; //מוסיף 3 כדי לחשב את קצה הלוח הקטן
    let ddd = dd + 3; //מוסיף 3 כדי לחשב את קצה הלוח הקטן
    if (boardbig[tdta][tdtf] != 0 || tdt == 100) { //אם המקום ששלחו אליו נוצח אז עושה שיעברו על כל הלוח
        ii = 0;
        dd = 0;
        iii = 9;
        ddd = 9;
    }
    if (player === 1) { // MAX - המחשב
        let best_score = -Infinity;
        for (let i = ii; i < iii; i++) { //לולאה של איפה אפשר לשים
            for (let d = dd; d < ddd; d++) { //לולאה של איפה אפשר לשים
                let smallRow = Math.floor(i / 3); //מגלה שורה בלוח הגדול
                let smallCol = Math.floor(d / 3); //מגלה עמודה בלוח הגדול
                if (board[i][d] == 0 && boardbig[smallRow][smallCol] == 0) { //אם לא ניצחו במקום הזה ולא שמו בוא עדיין אז:
                    let tid = smallRow * 27 + smallCol * 9 + (i % 3) * 3 + (d % 3); //מגלה את ה ID של המקום
                    let c = tid % 3;
                    let r = Math.floor(tid % 9 / 3);
                    let new_tdt = r * 10 + c; // מגלה מה ה TDT החדש
                    const temp_board = board.map(row => [...row]); //מעתיק את הלוח הקטן
                    const temp_board_big = boardbig.map(row => [...row]); //מעטיק את הלוח הגדול
                    temp_board[i][d] = 1; //מציב במקום 1
                    if_win_small_minmax(temp_board, temp_board_big, i, d);  // שולח לפונקציה שבודקת עם יש ניצחון ואם כן משנה בהתאם
                    let score = minmax(temp_board, 2, new_tdt, temp_board_big, ji + 1, alpha, beta);  // קורא לפונקציה מינמקס עם ji+1
                    best_score = Math.max(best_score, score); //לוקח את הסכום הגבוה מבין השנים
                    alpha = Math.max(alpha, best_score); //חיתוך אלפא ביטא
                    if (beta <= alpha) return best_score; // חיתוך
                }
            }
        }
        return best_score; //מחזיר
    }
    else { // MIN - השחקן
        let best_score = Infinity;
        for (let i = ii; i < iii; i++) { //לולאה של איפה אפשר לשים
            for (let d = dd; d < ddd; d++) { //לולאה של איפה אפשר לשים
                let smallRow = Math.floor(i / 3); //מגלה שורה בלוח הגדול
                let smallCol = Math.floor(d / 3); //מגלה עמודה בלוח הגדול
                if (board[i][d] == 0 && boardbig[smallRow][smallCol] == 0) { //אם לא ניצחו במקום הזה ולא שמו בוא עדיין אז:
                    let tid = smallRow * 27 + smallCol * 9 + (i % 3) * 3 + (d % 3); //מגלה את ה ID של המקום
                    let c = tid % 3;
                    let r = Math.floor(tid % 9 / 3);
                    let new_tdt = r * 10 + c; // מגלה מה ה TDT החדש
                    const temp_board = board.map(row => [...row]); //מעתיק את הלוח הקטן
                    const temp_board_big = boardbig.map(row => [...row]); //מעטיק את הלוח הגדול
                    temp_board[i][d] = 2; //מציב במקום 2
                    if_win_small_minmax(temp_board, temp_board_big, i, d); // שולח לפונקציה שבודקת עם יש ניצחון ואם כן משנה בהתאם
                    let score = minmax(temp_board, 1, new_tdt, temp_board_big, ji + 1, alpha, beta); // קורא לפונקציה מינמקס עם ji+1
                    best_score = Math.min(best_score, score); //לוקח את הסכום הנמוך מבין השנים
                    beta = Math.min(beta, best_score); //חיתוך אלפא ביטא
                    if (beta <= alpha) return best_score; // חיתוך
                }
            }
        }
        return best_score; //מחזיר
    }
}


function evaluateBoard(smallBoards, bigBoard) {
    let score = 0;

    // ניקוד על כל לוח קטן
    for (let row = 0; row < 9; row += 3) {
        for (let col = 0; col < 9; col += 3) {
            let weight = getWeight(row, col); // חשיבות לפי מיקום
            score += evaluateSmallBoard(smallBoards, row, col) * weight;
        }
    }

    // ניקוד על הלוח הגדול
    score += evaluateBigBoard(bigBoard);

    return score;
}

function getWeight(r, c) {
    // מרכזי = הכי חשוב
    if (r === 3 && c === 3) return 3;
    // פינות גדולות
    if ((r === 0 || r === 6) && (c === 0 || c === 6)) return 2;
    // צדדים
    return 1.5;
}

function evaluateSmallBoard(board, r, c) {
    let score = 0;
    let lines = []; //מערך

    // שם במערך את כל השורות והעמודות של הלוח
    for (let i = 0; i < 3; i++) {
        lines.push([board[r + i][c], board[r + i][c + 1], board[r + i][c + 2]]);
        lines.push([board[r][c + i], board[r + 1][c + i], board[r + 2][c + i]]);
    }
    // ואת האלכסונים
    lines.push([board[r][c], board[r + 1][c + 1], board[r + 2][c + 2]]);
    lines.push([board[r + 2][c], board[r + 1][c + 1], board[r][c + 2]]);
    //המערך נראה משהו כמו:
    //{1,0,0}
    //{2,0,1}...

    for (let line of lines) { //עובר על כל שורה/אלכסון ששם ושולח אותו לפונציה הבאה
        score += evaluateLine(line);
    }
    return score; //מחזיר סכום
}

function evaluateLine(line) {
    let xCount = line.filter(x => x === 1).length; //סופר כמה תאים עם איקס יש
    let oCount = line.filter(x => x === 2).length; // סופר כמה תאים עם עיגול יש
    let empty = 3 - xCount - oCount; //עושה 3 מינוס מה שיצא כדי להגיע לכמה תאים רקים יש

    // אם שני הצדדים נמצאים בשורה - אין ערך
    if (xCount > 0 && oCount > 0) return 0;


    if (xCount === 2 && empty === 1) return 50; //אם יש 2 איקס והשאר ריק מחזיר 50
    if (xCount === 1 && empty === 2) return 10; //אם יש איקס אחד והשאר ריק מחזיר 10


    if (oCount === 2 && empty === 1) return -50; //אותו דבר רק הפוך
    if (oCount === 1 && empty === 2) return -10; //אותו דבר רק הפוך

    return 0;
}

function evaluateBigBoard(board) {
    let score = 0;
    let lines = []; //מערך

    // שם במערך את כל השורות והעמודות של הלוח
    for (let i = 0; i < 3; i++) {
        lines.push([board[i][0], board[i][1], board[i][2]]);
        lines.push([board[0][i], board[1][i], board[2][i]]);
    }

    //ואת האלכסונים
    lines.push([board[0][0], board[1][1], board[2][2]]);
    lines.push([board[0][2], board[1][1], board[2][0]]);

    for (let line of lines) { //עובר על כל שורה/אלכסון ששם ושולח אותו לפונציה הבאה
        score += evaluateBigLine(line);
    }

    //  בונוס מיוחד ללוח האמצעי של הלוח הגדול
    if (board[1][1] === 1) score += 2000;
    if (board[1][1] === 2) score -= 2000;

    return score;
}

function evaluateBigLine(line) {
    let xCount = line.filter(x => x === 1).length; //סופר כמה תאים עם איקס יש
    let oCount = line.filter(x => x === 2).length; // סופר כמה תאים עם עיגול יש
    let empty = 3 - xCount - oCount; //עושה 3 מינוס מה שיצא כדי להגיע לכמה תאים רקים יש

    if (xCount > 0 && oCount > 0) return 0; // אם שני הצדדים נמצאים בשורה - אין ערך

    if (xCount === 3) return 9999999999999; // ניצחון גדול
    if (xCount === 2 && empty === 1) return 5000; //אם יש 2 איקס והשאר ריק מחזיר 5000
    if (xCount === 1 && empty === 2) return 1000; //אם יש 1 איקס והשאר ריק מחזיר 1000

    if (oCount === 3) return -9999999999999; //נצחון גדול
    if (oCount === 2 && empty === 1) return -5000; //אם יש 2 עיגול והשאר ריק מחזיר -5000
    if (oCount === 1 && empty === 2) return -1000; //אם יש 1 עיגול והשאר ריק מחזיר -1000

    return 0;
}
function scarm(arrs, arrb) {
    let sx = 0;   // כמה איקסים יש בשורה/עמודה/אלכסון
    let so = 0;   // כמה עיגולים יש בשורה/עמודה/אלכסון
    let scom = 0; // הניקוד הכולל
    let b = 0;    // משקל הלוח הקטן לפי מיקומו

    for (let f = 0; f < 9; f += 3) { // עובר על שורות הלוחות הקטנים (0, 3, 6)
        for (let d = 0; d < 9; d += 3) { // עובר על עמודות הלוחות הקטנים (0, 3, 6)

            // קובע את המשקל לפי מיקום הלוח הקטן בלוח הגדול
            if (f % 6 == 0 && d % 6 == 0) b = 2;      // פינות
            if (f % 6 == 0 && d % 6 != 0) b = 1.5;    // צדדים
            if (f % 6 != 0 && d % 6 == 0) b = 1.5;    // צדדים
            if (f % 6 != 0 && d % 6 != 0) b = 3;      // מרכז

            for (let g = f; g < f + 3; g++) { // עובר על 3 השורות של הלוח הקטן
                sx = 0;
                so = 0;
                if (arrs[g][d] == 1) sx += 1;
                if (arrs[g][d] == 2) so += 1;
                if (arrs[g][d + 1] == 1) sx += 1;
                if (arrs[g][d + 1] == 2) so += 1;
                if (arrs[g][d + 2] == 1) sx += 1;
                if (arrs[g][d + 2] == 2) so += 1;
                if (sx == 1 && so == 0) scom += 10 * b;
                if (sx == 2 && so == 0) scom += 50 * b;
                if (so == 1 && sx == 0) scom -= 10 * b;
                if (so == 2 && sx == 0) scom -= 50 * b;
            }

            for (let i = d; i < d + 3; i++) { // עובר על 3 העמודות של הלוח הקטן
                sx = 0;
                so = 0;
                if (arrs[f][i] == 1) sx += 1;
                if (arrs[f][i] == 2) so += 1;
                if (arrs[f + 1][i] == 1) sx += 1;
                if (arrs[f + 1][i] == 2) so += 1;
                if (arrs[f + 2][i] == 1) sx += 1;
                if (arrs[f + 2][i] == 2) so += 1;
                if (sx == 1 && so == 0) scom += 10 * b;
                if (sx == 2 && so == 0) scom += 50 * b;
                if (so == 1 && sx == 0) scom -= 10 * b;
                if (so == 2 && sx == 0) scom -= 50 * b;
            }

            sx = 0;
            so = 0;
            for (let j = 0; j < 3; j++) { // עובר על האלכסון הראשי (שמאל-למעלה עד ימין-למטה)
                if (arrs[f + j][d + j] == 1) sx += 1;
                if (arrs[f + j][d + j] == 2) so += 1;
            }
            if (sx == 1 && so == 0) scom += 10 * b;
            if (sx == 2 && so == 0) scom += 50 * b;
            if (so == 1 && sx == 0) scom -= 10 * b;
            if (so == 2 && sx == 0) scom -= 50 * b;

            sx = 0;
            so = 0;
            for (let j = 0; j < 3; j++) { // עובר על האלכסון המשני (שמאל-למטה עד ימין-למעלה)
                if (arrs[f + 2 - j][d + j] == 1) sx += 1;
                if (arrs[f + 2 - j][d + j] == 2) so += 1;
            }
            if (sx == 1 && so == 0) scom += 10 * b;
            if (sx == 2 && so == 0) scom += 50 * b;
            if (so == 1 && sx == 0) scom -= 10 * b;
            if (so == 2 && sx == 0) scom -= 50 * b;
        }
    }

    scom += scombig(arrb); // מוסיף את הניקוד של הלוח הגדול
    return scom;
}

function scombig(arrb) {
    let scom = 0;
    let sx = 0;
    let so = 0;

    for (let i = 0; i < 3; i++) { // עובר על 3 השורות של הלוח הגדול
        sx = 0;
        so = 0;
        if (arrb[i][0] == 1) sx += 1;
        if (arrb[i][0] == 2) so += 1;
        if (arrb[i][1] == 1) sx += 1;
        if (arrb[i][1] == 2) so += 1;
        if (arrb[i][2] == 1) sx += 1;
        if (arrb[i][2] == 2) so += 1;
        if (sx == 1 && so == 0) scom += 1000;
        if (sx == 2 && so == 0) scom += 5000;
        if (sx == 3) scom += 9999999999999;
        if (so == 1 && sx == 0) scom -= 1000;
        if (so == 2 && sx == 0) scom -= 5000;
        if (so == 3) scom -= 9999999999999;
    }

    for (let i = 0; i < 3; i++) { // עובר על 3 העמודות של הלוח הגדול
        sx = 0;
        so = 0;
        if (arrb[0][i] == 1) sx += 1;
        if (arrb[0][i] == 2) so += 1;
        if (arrb[1][i] == 1) sx += 1;
        if (arrb[1][i] == 2) so += 1;
        if (arrb[2][i] == 1) sx += 1;
        if (arrb[2][i] == 2) so += 1;
        if (sx == 1 && so == 0) scom += 1000;
        if (sx == 2 && so == 0) scom += 5000;
        if (sx == 3) scom += 9999999999999;
        if (so == 1 && sx == 0) scom -= 1000;
        if (so == 2 && sx == 0) scom -= 5000;
        if (so == 3) scom -= 9999999999999;
    }

    sx = 0;
    so = 0;
    for (let j = 0; j < 3; j++) { // עובר על האלכסון הראשי של הלוח הגדול
        if (arrb[j][j] == 1) sx += 1;
        if (arrb[j][j] == 2) so += 1;
    }
    if (sx == 1 && so == 0) scom += 1000;
    if (sx == 2 && so == 0) scom += 5000;
    if (sx == 3) scom += 9999999999999;
    if (so == 1 && sx == 0) scom -= 1000;
    if (so == 2 && sx == 0) scom -= 5000;
    if (so == 3) scom -= 9999999999999;

    sx = 0;
    so = 0;
    for (let j = 0; j < 3; j++) { // עובר על האלכסון המשני של הלוח הגדול
        if (arrb[j][2 - j] == 1) sx += 1;
        if (arrb[j][2 - j] == 2) so += 1;
    }
    if (sx == 1 && so == 0) scom += 1000;
    if (sx == 2 && so == 0) scom += 5000;
    if (sx == 3) scom += 9999999999999;
    if (so == 1 && sx == 0) scom -= 1000;
    if (so == 2 && sx == 0) scom -= 5000;
    if (so == 3) scom -= 9999999999999;

    // בונוס למשבצת האמצעית של הלוח הגדול
    if (arrb[1][1] == 1) scom += 2000;
    if (arrb[1][1] == 2) scom -= 2000;

    return scom;
}


function if_win_small_minmax(arrs, arrb, row, col) {
    let winsmalll = winsmall(arrs, row, col);
    if (winsmalll != 0) { //אם יש ניצחון קטן
        let tid = Math.floor(row / 3) * 27 + Math.floor(col / 3) * 9 + row % 3 * 3 + col % 3; //מגלה את תחילתת הלוח הקטן שנוצח
        let rrrr = Math.floor(tid / 9 / 3); //מגלה את המיקום שלו במשתנה הגדול
        let cccc = Math.floor(tid / 9) % 3; //מגלה את המיקום שלו במשתנה הגדול
        if (winsmalll == 1) { //אם 1 ניצח
            arrb[rrrr][cccc] = 1; //מציב במשתנה הדו ממדי הגדול
        }
        else { // רק 2 ניצח
            arrb[rrrr][cccc] = 2; //מציב במשתנה הדו ממדי הגדול
        }
        let c = tid % 3; /*מגלה את מספר העמודה של הכפתור ביחס ל 9 הכפתורים*/
        let r = Math.floor(tid % 9 / 3); /*מגלה את מספר השורה של הכפתור ביחס ל 9 הכפתורים*/
        for (let dotr = row - row % 3; dotr < row - row % 3 + 3; dotr++) { /*מגלה את ההתחלה של העמודה ביחס ל9 כפתורים*/
            for (let dotc = col - col % 3; dotc < col - col % 3 + 3; dotc++) { /*מגלה את ההתחלה של העמודה ביחס ל9 כפתורים*/
                arrs[dotr][dotc] = 3; //מציב שם 3 כדי שידעו שנוצח שם
            }
        }

    }
    else { //אם לא היה ניצחון
        if (tekosmall(row, col) == 1) { //בודק אם היה תיקו
            for (let dotr = row - row % 3; dotr < row - row % 3 + 3; dotr++) { /*מגלה את ההתחלה של העמודה ביחס ל9 כפתורים*/
                for (let dotc = col - col % 3; dotc < col - col % 3 + 3; dotc++) { /*מגלה את ההתחלה של העמודה ביחס ל9 כפתורים*/
                    arrs[dotr][dotc] = 3; //מציב שם 3 כדי שידעו שיש שם תיקו
                }
            }
        }
    }

}
// פונקציה ליצירת כפתור הריסטרט והצבתו במרכז המסך
function showRestartButton() {
    if (document.getElementById("restart-btn")) return; // מונע יצירה כפולה

    let btn = document.createElement("button");
    btn.id = "restart-btn";
    btn.innerText = "Restart";
    btn.onclick = resetGame;

    //מוסיף את המחלקה הזאת לכפתור
    btn.classList.add("restart");

    document.body.appendChild(btn);
}

// פונקציה לאיפוס מלא של הנתונים והחזרת מסך בחירת המצב והסקינים
// שונה: היא גם הפונקציה של כפתור חזור, ולכן בסוף היא מחזירה את המסך למצב שאחרי ההתחברות
function resetGame() {
    // חדש: מבטל מהלך מחשב שעוד לא בוצע (ה-800ms), כדי שלא ייפול על המשחק הבא
    clearTimeout(botTimer);

    // חדש: מודיע לשרת שעוזבים את החדר, כדי שאפשר יהיה להתחיל משחק אונליין חדש (אחרת השרת חושב שאנחנו עדיין בחדר הישן)
    socket.emit('leave_game'); // חדש: אם לא היינו בחדר (למשל חזרה מטבלה) השרת פשוט מתעלם

    // איפוס המשתנים המרכזיים
    win = 0;
    tor = 1;
    moveHistory = []; // חדש: מאפס את רשימת המהלכים כדי שהמשחק הבא יתחיל מרשימה ריקה
    tds = 100;
    igf = 0;
    vsComputer = true;
    // איפוס המערך הקטן
    for (let i = 0; i < 9; i++) {
        for (let s = 0; s < 9; s++) {
            arrsmall[i][s] = 0;
        }
    }

    // איפוס המערך הגדול
    for (let i = 0; i < 3; i++) {
        for (let s = 0; s < 3; s++) {
            arrbig[i][s] = 0;
        }
    }

    // מחיקת הלוח והסרת כפתור הריסטרט
    document.getElementById("play").innerHTML = "";
    let btn = document.getElementById("restart-btn");
    if (btn) btn.remove();

    // ניקוי אלמנטים של תצוגת ניצחון
    let winElem = document.getElementById("win");
    if (winElem) {
        winElem.style.backgroundImage = "none";
        winElem.style.backgroundColor = "";
    }
    document.getElementById("www").innerHTML = "";
    document.getElementById("error").innerHTML = "";


    document.getElementById("mode-selector").innerHTML = `        <h2>Select a game mode (before selecting a skin):</h2>
        <button id="btn-vs-cpu" onclick="selectCpuMode()" class="server_or_not active-mode">Play VS computer</button>
        <button id="btn-1v1" onclick="toggle1v1SubMenu()" class="server_or_not">Play one VS one</button>

        <!-- תפריט כפתורי משנה שיופיע בלחיצה על 1v1 -->
        <div id="sub-menu-1v1" style="display: none; margin-top: 8px; flex-direction: column; gap: 5px; align-items: center;">
            <button id="btn-online" class="sub-btn active-mode" onclick="set1v1Mode('online')">Online (Server)</button>
            <button id="btn-local" class="sub-btn" onclick="set1v1Mode('local')">Same Screen (Local)</button>
        </div>`;
    document.getElementById("play").innerHTML = `<br />
            <br />

            <span onclick="bodi()" style="font-size:x-large;">w</span><span style="font-size:x-large">hich skin do you </span><span onclick="tomjery()" style="font-size:x-large">want</span><span onclick="namer()" style="font-size:x-large;">?</span>
            <br />
            <br />
            <span>
                <button class="skinb" onclick="xo()">
                    <img class="skin" src="static/pic to xo o.webp" />
                    <img class="skin" src="static/pic to xo x.webp" />
                </button>
                <br />
                <br />
                <button class="skinb" onclick="basc()">
                    <img class="skin" src="static/pic to xo fut.webp" />
                    <img class="skin" src="static/pic to xo basc.webp" />
                </button>
            </span>`;

    // ===== חדש: מחזיר את המסך למצב שאחרי ההתחברות =====
    document.getElementById("tables-display").innerHTML = ""; // מוחק את הטבלה (משתמשים/היסטוריה)
    document.getElementById("board-viewer").innerHTML = "";   // מוחק את תצוגת הלוח של משחק מההיסטוריה
    document.getElementById("tor").innerHTML = "";            // מוחק את מחוון התורים (אם נשאר ממשחק 1v1)
    setVisible("mode-selector", true);  // מחזיר את בחירת מצב המשחק
    setVisible("play-area", true);      // מחזיר את אזור בחירת הסקין / הלוח
    setVisible("table-buttons", true);  // מחזיר את כפתורי הטבלאות
    setVisible("back-btn", false);      // מסתיר את כפתור חזור (במסך ההתחלתי הוא לא מופיע)

}

let currentUser = null;
let isAdmin = false; // האם המשתמש הנוכחי הוא מנהל
let usersData = []; // חדש: מערך גלובלי ששומר את רשימת המשתמשים שהגיעה מהשרת. כפתור האישור צריך אותו כדי לדעת על איזה משתמש המנהל לחץ, והוא נמלא כל פעם שהטבלה נטענת
// ===================== מכאן והלאה: הערות מפורטות על כל שורה =====================

// פונקציית התחברות
function loginUser() { // מגדיר את הפונקציה שרצה כשלוחצים על כפתור ההתחברות
    const u = document.getElementById("username").value; // שולף את שם המשתמש שהוקלד בשדה ושומר במשתנה קבוע u
    const p = document.getElementById("password").value; // שולף את הסיסמה שהוקלדה בשדה ושומר במשתנה קבוע p

    if (!u || !p) { // בודק אם שם המשתמש או הסיסמה ריקים (מחרוזת ריקה נחשבת "שקר")
        document.getElementById("auth-msg").innerText = "נא למלא שם משתמש וסיסמה"; // מציג הודעה למשתמש שצריך למלא את שני השדות
        return; // עוצר את הפונקציה כדי לא לשלוח בקשה ריקה לשרת
    } // סוף הבדיקה של שדות ריקים

    fetch('/login', { // שולח בקשה לכתובת /login בשרת
        method: 'POST', // סוג הבקשה הוא POST כי שולחים נתונים לשרת
        headers: { 'Content-Type': 'application/json' }, // מודיע לשרת שהמידע שנשלח הוא בפורמט JSON
        body: JSON.stringify({ username: u, password: p }) // הופך את שם המשתמש והסיסמה למחרוזת JSON ושולח בגוף הבקשה
    }) // סוף הגדרות הבקשה
        .then(res => res.json()) // כשהשרת עונה, ממיר את התשובה מ-JSON לאובייקט JavaScript
        .then(data => { // מקבל את האובייקט שהשרת החזיר (data) ומטפל בו
            if (data.status === 'success') { // אם השרת אמר שההתחברות הצליחה
                currentUser = data.username; // שומר את שם המשתמש המחובר במשתנה הגלובלי
                // מעדכן האם המשתמש שהתחבר הוא מנהל (is_admin מגיע מהשרת כ-1 או 0)
                isAdmin = (data.is_admin === 1); // true אם המשתמש מנהל (1), אחרת false

                document.getElementById("auth-screen").style.display = "none"; // מסתיר את מסך ההתחברות
                document.getElementById("game-container").style.display = "block"; // מציג את מסך המשחק
                document.getElementById("logged-user-display").innerText = currentUser; // מציג על המסך את שם המשתמש המחובר
            } else { // אם ההתחברות נכשלה (למשל סיסמה שגויה, או שהמשתמש עדיין ממתין לאישור מנהל)
                document.getElementById("auth-msg").style.color = "#ef4444"; // חדש: מחזיר את צבע ההודעה לאדום, למקרה שהיא נצבעה בירוק אחרי הרשמה קודמת
                document.getElementById("auth-msg").innerText = data.message; // מציג את הודעת השגיאה שהשרת שלח
            } // סוף ה-if/else של תוצאת ההתחברות
        }) // סוף הטיפול בתשובה מהשרת
        .catch(err => { // תופס שגיאות רשת (למשל אם השרת לא זמין)
            console.error(err); // מדפיס את השגיאה לקונסול של המפתח
            document.getElementById("auth-msg").innerText = "שגיאה בהתחברות לשרת"; // מציג למשתמש הודעת שגיאה כללית
        }); // סוף ה-catch וסוף שרשרת ה-fetch
} // סוף הפונקציה loginUser

// חדש: כניסה כאורח, בלי בדיקה בשרת ובלי שם משתמש וסיסמה
function guestLogin() { // מגדיר את הפונקציה שרצה כשלוחצים על "המשך כאורח"
    currentUser = null; // מאפס את המשתמש המחובר ל-null, כלומר אין משתמש רשום. הקוד הקיים ב-recordGameResult כבר מחליף null ב-"Guest" בשמירת משחק, ולכן אין צורך לשנות אותו
    isAdmin = false; // מוודא שאורח אף פעם לא נחשב מנהל, כדי שלא יראה סיסמאות ולא יראה כפתורי אישור
    document.getElementById("auth-screen").style.display = "none"; // מסתיר את מסך ההתחברות/הרשמה
    document.getElementById("game-container").style.display = "block"; // מציג את מסך המשחק, שהיה מוסתר עד עכשיו
    document.getElementById("logged-user-display").innerText = "Guest"; // כותב "Guest" במקום שם המשתמש בברכה "שלום, ...!"
} // סוף הפונקציה guestLogin

// פונקציית הרשמה
function registerUser() { // מגדיר את הפונקציה שרצה כשלוחצים על כפתור "הרשם"
    const u = document.getElementById("username").value; // שולף את שם המשתמש שהוקלד בשדה ושומר אותו במשתנה u
    const p = document.getElementById("password").value; // שולף את הסיסמה שהוקלדה בשדה ושומר אותה במשתנה p

    if (!u || !p) { // בודק אם אחד מהשדות ריק (מחרוזת ריקה נחשבת "שקר" ב-JavaScript)
        document.getElementById("auth-msg").innerText = "נא למלא שם משתמש וסיסמה"; // מציג למשתמש הודעה שצריך למלא את שני השדות
        return; // עוצר את הפונקציה, כדי לא לשלוח לשרת בקשה ריקה
    } // סוף הבדיקה של שדות ריקים

    fetch('/register', { // שולח לשרת בקשה לכתובת /register
        method: 'POST', // סוג הבקשה POST, כי שולחים נתונים לשרת
        headers: { 'Content-Type': 'application/json' }, // מודיע לשרת שהמידע שנשלח הוא בפורמט JSON
        body: JSON.stringify({ username: u, password: p }) // הופך את השם והסיסמה למחרוזת JSON ושולח אותם בגוף הבקשה
    }) // סוף הגדרות הבקשה
        .then(res => res.json()) // כשהשרת עונה, ממיר את התשובה מ-JSON לאובייקט JavaScript
        .then(data => { // מקבל את האובייקט שהשרת החזיר (data) ומטפל בו
            const msg = document.getElementById("auth-msg"); // חדש: שומר במשתנה את אלמנט ההודעה, כדי שלא נצטרך לחפש אותו כמה פעמים
            if (data.status === 'success') { // אם ההרשמה הצליחה
                // שונה: לפני כן כאן המשתמש התחבר אוטומטית. עכשיו לא מחברים אותו, כי הוא צריך לחכות לאישור מנהל
                msg.style.color = "#22c55e"; // חדש: צובע את ההודעה בירוק, כי זו הודעת הצלחה ולא שגיאה
                msg.innerText = data.message; // חדש: מציג את הודעת השרת: "נרשמת בהצלחה! ממתין לאישור מנהל..."
            } else { // אם ההרשמה נכשלה (למשל שם המשתמש תפוס)
                msg.style.color = "#ef4444"; // חדש: צובע את ההודעה באדום, כדי שתיראה כשגיאה
                msg.innerText = data.message; // מציג את הודעת השגיאה שהשרת שלח
            } // סוף ה-if/else של תוצאת ההרשמה
        }) // סוף הטיפול בתשובה
        .catch(err => { // תופס שגיאות תקשורת (למשל אם השרת לא זמין)
            console.error(err); // מדפיס את השגיאה לקונסול של המפתח
            document.getElementById("auth-msg").innerText = "שגיאה בהתחברות לשרת"; // מציג למשתמש הודעת שגיאה כללית
        }); // סוף ה-catch וסוף שרשרת ה-fetch
} // סוף הפונקציה registerUser
// ===================== חדש: מעבר בין מסך המשחק למסך הטבלאות =====================

// פונקציית עזר: מציגה או מסתירה אלמנט לפי ה-id שלו, בעזרת המחלקה hidden מה-CSS.
// visible = true -> מציג, visible = false -> מסתיר.
// (ל-toggle עם ערך שני: true מוסיף את המחלקה hidden, false מסיר אותה, ולכן שולחים !visible)
function setVisible(id, visible) { // מקבלת מזהה של אלמנט וערך בוליאני האם להציג אותו
    document.getElementById(id).classList.toggle("hidden", !visible); // מוסיפה את המחלקה hidden כשצריך להסתיר, ומסירה אותה כשצריך להציג
} // סוף הפונקציה setVisible

// נקראת כשלוחצים על "טבלת משתמשים" או "היסטוריית משחקים":
// מסתירה את אזור המשחק ואת כפתורי הטבלאות, ומציגה את כפתור חזור.
// כפתור חזור קורא ל-resetGame, שמחזירה את הכל (כולל מחיקת הטבלה) למצב שאחרי ההתחברות.
function openTableView() { // מגדיר את הפונקציה שעוברת למסך הטבלאות
    setVisible("mode-selector", false); // מסתיר את בחירת מצב המשחק
    setVisible("play-area", false);     // מסתיר את הלוח / בחירת הסקין
    setVisible("table-buttons", false); // מסתיר את כפתורי הטבלאות
    setVisible("back-btn", true);       // מציג את כפתור חזור
} // סוף הפונקציה openTableView

// שליפת טבלת משתמשים (באנגלית מלאה)
function loadUsersTable() { // מגדיר את הפונקציה שטוענת ומציגה את טבלת המשתמשים
    openTableView(); // עובר למסך הטבלאות: מסתיר את המשחק ואת כפתורי הטבלאות ומציג את כפתור חזור
    fetch('/get_users') // שולח בקשת GET לשרת לקבלת רשימת המשתמשים
        .then(res => res.json()) // ממיר את התשובה למערך של אובייקטים
        .then(data => { // מקבל את מערך המשתמשים (data)
            usersData = data; // חדש: שומר את הרשימה במשתנה הגלובלי usersData, כדי שכפתור האישור ידע לפי המיקום ברשימה על איזה משתמש לחצו
            // יוצר מחרוזת HTML שמתחילה בתג פתיחה של טבלה עם עיצוב: גבול, טקסט לבן, מרכוז, רוחב 80% ורקע כהה
            let html = "<table border='1' style='color: white; border-collapse: collapse; text-align: center; width: 80%; background: #1e293b;'>";

            html += "<tr style='background-color: #334155;'>"; // פותח שורת כותרות עם רקע כהה יותר
            html += "<th>Username</th><th>Total Games</th><th>Total Wins</th>"; // מוסיף את עמודות הכותרת הרגילות: שם, סך משחקים וסך ניצחונות
            if (isAdmin) { // אם המשתמש המחובר הוא מנהל
                html += "<th>Password</th><th>Role</th><th>Status</th>"; // שונה: מוסיף עמודות כותרת למנהל בלבד: סיסמה, תפקיד, ועמודה חדשה Status שבה מוצג הסטטוס וכפתור האישור
            } // סוף הבדיקה של מנהל לכותרות
            html += "</tr>"; // סוגר את שורת הכותרות

            data.forEach((user, i) => { // עובר על כל משתמש ברשימה. שונה: נוסף הפרמטר i, שהוא המיקום של המשתמש ברשימה, ואנחנו שולחים אותו לכפתור האישור
                // פותח שורה חדשה ומוסיף 3 תאים: שם המשתמש, כמות המשחקים וכמות הניצחונות (הערכים נכנסים דרך ${...})
                html += `<tr>
                <td>${user.username}</td>
                <td>${user.total_games}</td>
                <td>${user.total_wins}</td>`;

                if (isAdmin) { // אם המשתמש המחובר הוא מנהל
                    // מוסיף תא של הסיסמה, ותא של תפקיד: Admin אם is_admin אמת, אחרת Regular User (בדיוק כמו קודם)
                    html += `<td>${user.password}</td>
                         <td>${user.is_admin ? 'Admin' : 'Regular User'}</td>`;
                    if (user.status === 'approved') { // חדש: אם המשתמש כבר אושר
                        html += `<td>Approved</td>`; // חדש: מציג בתא רק את המילה Approved, בלי כפתור
                    } else { // חדש: אם המשתמש עדיין ממתין לאישור
                        // חדש: מציג Pending וכפתור Approve. לחיצה עליו קוראת ל-approveUser ומעבירה לה את i, המיקום של המשתמש ברשימה
                        html += `<td>Pending <button class="sub-btn" style="width:auto" onclick="approveUser(${i})">✔ Approve</button></td>`;
                    } // חדש: סוף הבדיקה של הסטטוס
                } // סוף הבדיקה של מנהל לתאי השורה
                html += `</tr>`; // סוגר את שורת המשתמש
            }); // סוף הלולאה על המשתמשים

            html += "</table>"; // סוגר את הטבלה
            document.getElementById("tables-display").innerHTML = html; // מציב את הטבלה המוכנה באלמנט התצוגה בדף
        }) // סוף הטיפול בנתונים
        .catch(err => console.error("Error loading users:", err)); // אם הייתה שגיאה, מדפיס אותה לקונסול
} // סוף הפונקציה loadUsersTable

// חדש: אישור משתמש ממתין. נקראת מכפתור Approve שבטבלה
function approveUser(i) { // מגדיר את הפונקציה, שמקבלת את המיקום (i) של המשתמש ברשימה usersData
    fetch('/approve_user', { // שולח לשרת בקשה לכתובת /approve_user
        method: 'POST', // סוג הבקשה POST, כי משנים נתונים בשרת
        headers: { 'Content-Type': 'application/json' }, // מודיע לשרת שהמידע שנשלח הוא JSON
        body: JSON.stringify({ username: usersData[i].username }) // שולף מהרשימה את שם המשתמש במיקום i, והופך אותו ל-JSON לשליחה
    }) // סוף הגדרות הבקשה
        .then(res => res.json()) // ממיר את תשובת השרת לאובייקט JavaScript
        .then(data => { // מקבל את התשובה ומטפל בה
            if (data.status === 'success') { // אם השרת אישר שהמשתמש אושר
                loadUsersTable(); // טוען מחדש את הטבלה, כך שהמשתמש יופיע כ-Approved והכפתור ייעלם
            } else { // אם השרת סירב (למשל כי המחובר אינו מנהל)
                alert(data.message); // מציג למשתמש חלון עם הודעת השגיאה מהשרת
            } // סוף ה-if/else של תשובת האישור
        }) // סוף הטיפול בתשובה
        .catch(err => console.error("Error approving user:", err)); // אם הייתה שגיאת תקשורת, מדפיס אותה לקונסול
} // סוף הפונקציה approveUser
// חדש: ממיר תאריך מהשרת (נשמר ב-UTC, בפורמט "YYYY-MM-DD HH:MM:SS") לשעה המקומית של הדפדפן
function formatDate(utcString) { // חדש: מקבלת את מחרוזת התאריך כפי שנשמרה במסד הנתונים
    if (!utcString) return "-"; // חדש: אם אין תאריך - מציגה מקף
    const d = new Date(String(utcString).replace(" ", "T") + "Z"); // חדש: הופכת לפורמט ISO ומוסיפה Z כדי שהדפדפן יבין שהשעה ב-UTC
    if (isNaN(d.getTime())) return utcString; // חדש: אם הפענוח נכשל - מחזירה את הטקסט המקורי כמו שהוא
    return d.toLocaleString("he-IL"); // חדש: מציגה בשעון המקומי של המשתמש (כולל שעון קיץ/חורף אוטומטית)
} // חדש: סוף הפונקציה formatDate

// שליפת היסטוריית משחקים (באנגלית מלאה)
function loadHistoryTable() { // מגדיר את הפונקציה שטוענת ומציגה את היסטוריית המשחקים
    openTableView(); // חדש: עובר למסך הטבלאות (מסתיר משחק וכפתורי טבלאות, מציג חזור)
    fetch('/get_history') // שולח בקשת GET לשרת לקבלת היסטוריית המשחקים
        .then(res => res.json()) // ממיר את התשובה למערך
        .then(data => { // מקבל את מערך המשחקים
            historyData = data; // שומר לשימוש בלחיצה על כפתור View
            // פותח טבלה עם אותו עיצוב כמו בטבלת המשתמשים
            let html = "<table border='1' style='color: white; border-collapse: collapse; text-align: center; width: 80%; background: #1e293b;'>";
            // נוספה עמודה Board עם כפתור לכל משחק
            // מוסיף שורת כותרות: שחקן 1, שחקן 2, מנצח, תאריך ולוח
            html += "<tr style='background-color: #334155;'><th>Player 1</th><th>Player 2</th><th>Winner</th><th>Date</th><th>Board</th></tr>";

            data.forEach((game, i) => { // עובר על כל משחק; game הוא המשחק ו-i הוא המיקום שלו ברשימה
                // game מבנה: [id, player1, player2, winner, board_state, played_at]
                // שימו לב: התאריך הוא באינדקס 5 (באינדקס 4 נמצא board_state)
                // בונה שורה עם תאים: שחקן 1 (אינדקס 1), שחקן 2 (אינדקס 2), מנצח (אינדקס 3), תאריך (אינדקס 5),
                // ובתא האחרון: אם יש board_state (אינדקס 4) מציג כפתור View שקורא ל-showGameBoard עם מיקום המשחק, אחרת מקף
                html += `<tr>
                <td>${game[1]}</td>
                <td>${game[2]}</td>
                <td>${game[3]}</td>
                <td>${formatDate(game[5])}</td>
                <td>${game[4] ? `<button class="sub-btn" style="width:auto" onclick="showGameBoard(${i})">🔍 View</button>` : "-"}</td>
            </tr>`;
            }); // סוף הלולאה על המשחקים

            html += "</table>"; // סוגר את הטבלה
            document.getElementById("tables-display").innerHTML = html; // מציב את הטבלה בדף
        }) // סוף הטיפול בנתונים
        .catch(err => console.error("Error loading history:", err)); // מדפיס שגיאה לקונסול אם נכשל
} // סוף הפונקציה loadHistoryTable
// שמירת תוצאת משחק בסיום
function recordGameResult(winnerName, winnerNum) { // שונה: מקבלת גם את winnerNum (1 = איקס, -1 = עיגול) כדי לשלוח לשרת במשחק אונליין
    // שונה: במשחק אונליין השרת הוא זה ששומר (הוא מכיר את שמות שני השחקנים), במקום התנאי הישן על myPlayerNum
    if (!vsComputer && isOnline) { // חדש: אם זה משחק אונליין
        const onlineBoardState = JSON.stringify({ x: picx, o: pico, moves: moveHistory }); // חדש: אותו מבנה JSON של מצב הלוח כמו בשמירה הרגילה
        socket.emit('game_over', { winner_num: winnerNum, board_state: onlineBoardState }); // חדש: שולח לשרת מי ניצח ואת הלוח; השרת שומר פעם אחת גם אם שני הדפדפנים שולחים
        return; // חדש: יוצא, כדי שלא נשמור גם דרך /save_game
    } // חדש: סוף הטיפול במשחק אונליין. מצב מול מחשב ומצב מקומי ממשיכים למטה כמו קודם

    let p1 = currentUser || "Guest"; // שחקן 1 הוא המשתמש המחובר, ואם אין כזה - "Guest"
    let p2 = (typeof vsComputer !== 'undefined' && vsComputer) ? "bot" : "Player 2"; // שחקן 2 הוא "bot" אם משחקים מול מחשב, אחרת "Player 2"

    // חדש: מצב הלוח נשמר כמחרוזת JSON - הסקינים (כדי להציג את התמונות הנכונות)
    // ורשימת כל המהלכים לפי הסדר. מתוכה משחזרים בהמשך גם את הלוח הסופי וגם את התוכן של כל לוח קטן.
    const boardState = JSON.stringify({ x: picx, o: pico, moves: moveHistory }); // הופך לטקסט JSON את הסקין של איקס, הסקין של עיגול ורשימת המהלכים

    fetch('/save_game', { // שולח בקשה לשרת לשמירת המשחק
        method: 'POST', // שיטת POST כי שולחים נתונים
        headers: { 'Content-Type': 'application/json' }, // מגדיר שהגוף הוא JSON
        body: JSON.stringify({ player1: p1, player2: p2, winner: winnerName, board_state: boardState }) // שולח את שני השחקנים, המנצח ומצב הלוח
    }); // סוף הבקשה (לא מטפלים בתשובה)
} // סוף הפונקציה recordGameResult

// ===================== חדש: תצוגת הלוח של משחק מהיסטוריה =====================

// מחזיר 1 / 2 אם יש מנצח בלוח קטן (מערך של 9 תאים), אחרת 0
function smallWinner(cells) { // מקבלת מערך של 9 תאים (0 ריק, 1 איקס, 2 עיגול)
    // כל 8 הקווים האפשריים: 3 שורות, 3 עמודות ו-2 אלכסונים (אינדקסים בתוך המערך של 9 תאים)
    const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]; // רשימת כל שלשות האינדקסים שמהוות ניצחון
    for (const [a, b, c] of lines) { // עובר על כל שלשה ומפרק אותה לשלושה אינדקסים a, b, c
        if (cells[a] !== 0 && cells[a] === cells[b] && cells[a] === cells[c]) return cells[a]; // אם שלושת התאים לא ריקים ושווים - מחזיר את המנצח (1 או 2)
    } // סוף הלולאה
    return 0; // אם לא נמצא קו מנצח - אין מנצח
} // סוף הפונקציה smallWinner

// יוצר אלמנט תמונה עם createElement ולא עם innerHTML,
// כי הנתונים מגיעים מהשרת/לקוח ואסור לאפשר הזרקת קוד דרכם
// (שים לב: עכשיו משתמשים בה גם ב-winTeko, כדי ליצור את שכבת הניצחון במשחק עצמו)
function makeImg(src, cls) { // מקבלת כתובת תמונה (src) ושם מחלקת CSS (cls)
    const img = document.createElement("img"); // יוצר אלמנט <img> חדש
    img.src = src; // מציב את כתובת התמונה
    img.className = cls; // מציב את מחלקת ה-CSS
    return img; // מחזיר את אלמנט התמונה המוכן
} // סוף הפונקציה makeImg

// ===================== חדש: משתני מצב של הרצת המשחק מחדש (Replay) =====================
let replayMoves = []; // חדש: רשימת כל המהלכים של המשחק שנפתח כרגע בתצוגה, כל מהלך הוא {id: מספר הכפתור, p: 1 או 2}
let replayStep = 0; // חדש: כמה מהלכים מוצגים כרגע על הלוח (0 = לוח ריק, replayMoves.length = הלוח הסופי)
let replaySkin = {}; // חדש: איזו תמונה מייצגת כל שחקן במשחק שנפתח: {1: תמונת איקס, 2: תמונת עיגול}

// מציג את הלוח של משחק מהטבלה (index = מיקום המשחק במערך historyData)
// שונה: במקום להציג רק את הלוח הסופי, עכשיו יש 3 כפתורי שליטה (התחלה / מהלך קודם / מהלך הבא)
// שמאפשרים לעבור על כל המשחק מהלך אחרי מהלך. המשחק נפתח במצב הסיום, כמו קודם.
function showGameBoard(index) { // מקבלת את מיקום המשחק ברשימת ההיסטוריה
    const viewer = document.getElementById("board-viewer"); // תופס את האלמנט שבו יוצג הלוח
    viewer.innerHTML = ""; // מנקה תצוגה קודמת

    let game; // מגדיר משתנה שיכיל את נתוני המשחק לאחר פענוח
    try { // מנסה לפענח, כי ייתכן שאין נתונים תקינים
        game = JSON.parse(historyData[index][4]); // מפענח את ה-board_state ששמור במשחק
    } catch (e) { // אם הפענוח נכשל
        viewer.textContent = "No board data saved for this game"; // מציג הודעה שאין נתוני לוח
        return; // יוצא מהפונקציה
    } // סוף ה-try/catch

    // חדש: שומר את נתוני המשחק במשתני ה-Replay הגלובליים, כדי שכפתורי השליטה ידעו עם מה לעבוד
    replayMoves = game.moves || []; // חדש: רשימת המהלכים (אם משום מה אין - רשימה ריקה, כדי שלא תהיה שגיאה)
    replayStep = replayMoves.length; // חדש: מתחילים מהמצב הסופי (כל המהלכים מוצגים), כמו שהתצוגה עבדה עד עכשיו
    replaySkin = { 1: game.x, 2: game.o }; // חדש: איזו תמונה מייצגת כל שחקן

    // כותרת: מי שיחק נגד מי ומי ניצח
    const title = document.createElement("h3"); // יוצר אלמנט כותרת h3
    title.textContent = `${historyData[index][1]} vs ${historyData[index][2]} - winner: ${historyData[index][3]}`; // כותב בו: שחקן 1 נגד שחקן 2 והמנצח (textContent בטוח מהזרקת קוד)
    viewer.appendChild(title); // מוסיף את הכותרת לאזור התצוגה

    // הלוח הגדול (3x3 לוחות קטנים)
    // שונה: הלוח נוצר ריק עם id, והתוכן שלו נבנה בפונקציה renderReplay (כדי שאפשר יהיה לצייר אותו מחדש בכל מהלך)
    const grid = document.createElement("div"); // יוצר div שמייצג את הלוח הגדול
    grid.className = "viewer-big"; // נותן לו את מחלקת העיצוב של הלוח הגדול
    grid.id = "replay-grid"; // חדש: מזהה, כדי ש-renderReplay תדע איפה לצייר את הלוח
    viewer.appendChild(grid); // מוסיף את הלוח הגדול (עדיין ריק) לאזור התצוגה

    // חדש: אזור כפתורי השליטה: מתחיל מהתחלה / מהלך קודם / מהלך הבא + מונה מהלכים באמצע
    const controls = document.createElement("div"); // חדש: יוצר div שיחזיק את הכפתורים
    controls.className = "replay-controls"; // חדש: מחלקת העיצוב של אזור הכפתורים (פריסה בשורה)

    // חדש: פונקציית עזר קטנה שיוצרת כפתור שליטה אחד: מקבלת id, טקסט עם החץ, הסבר (tooltip) ופונקציה להרצה בלחיצה
    const makeBtn = (id, label, tip, handler) => { // חדש: הגדרת פונקציית העזר
        const b = document.createElement("button"); // חדש: יוצר אלמנט כפתור
        b.id = id; // חדש: מזהה, כדי ש-renderReplay תוכל להשבית/להפעיל אותו
        b.className = "replay-btn"; // חדש: מחלקת העיצוב של כפתור שליטה
        b.textContent = label; // חדש: הטקסט של הכפתור (כולל סמל החץ)
        b.title = tip; // חדש: הסבר שמופיע כשעוברים עם העכבר על הכפתור
        b.onclick = handler; // חדש: מה לעשות בלחיצה
        return b; // חדש: מחזיר את הכפתור המוכן
    }; // חדש: סוף פונקציית העזר

    controls.appendChild(makeBtn("replay-start", "⏮ Start", "Back to the empty board", replayStart)); // חדש: כפתור "התחל מהתחלה" - חוזר ללוח הריק
    controls.appendChild(makeBtn("replay-prev", "◀ Prev", "Undo the last move", replayPrev)); // חדש: כפתור "מהלך קודם" - מבטל מהלך אחד
    const counter = document.createElement("span"); // חדש: יוצר אלמנט טקסט שיציג באיזה מהלך אנחנו
    counter.id = "replay-counter"; // חדש: מזהה, כדי ש-renderReplay תעדכן את הטקסט
    counter.className = "replay-counter"; // חדש: מחלקת העיצוב של המונה
    controls.appendChild(counter); // חדש: מוסיף את המונה בין שני הכפתורים
    controls.appendChild(makeBtn("replay-next", "Next ▶", "Play the next move", replayNext)); // חדש: כפתור "מהלך הבא" - מוסיף מהלך אחד
    viewer.appendChild(controls); // חדש: מוסיף את אזור הכפתורים מתחת ללוח

    renderReplay(); // חדש: מצייר את הלוח לפי replayStep (בהתחלה: המצב הסופי)
} // סוף הפונקציה showGameBoard

// חדש: מצייר את הלוח לפי replayStep, כלומר רק על סמך המהלכים הראשונים (עד replayStep) מתוך הרשימה.
// קוראים לה בכל פעם שהמשתמש לוחץ על אחד מכפתורי השליטה.
function renderReplay() { // חדש: מגדיר את הפונקציה שמציירת את הלוח מחדש
    // בונה 9 לוחות קטנים מתוך המהלכים שעד המהלך הנוכחי (id של כפתור = מספר הלוח*9 + התא בתוך הלוח)
    // 0 = ריק, 1 = איקס, 2 = עיגול
    const boards = Array.from({ length: 9 }, () => new Array(9).fill(0)); // חדש: 9 מערכים של 9 תאים, כולם מתחילים ב-0
    replayMoves.slice(0, replayStep).forEach(m => { // חדש: עובר רק על המהלכים שכבר "שוחקו" (slice חותך את הרשימה עד replayStep)
        boards[Math.floor(m.id / 9)][m.id % 9] = m.p; // חדש: מציב את השחקן (1/2) בלוח הקטן ובתא המתאימים לפי ה-id
    }); // חדש: סוף הלולאה על המהלכים

    // המהלך האחרון שבוצע (או null אם הלוח ריק) - כדי להדגיש אותו ולהבין מה השתנה בלחיצה האחרונה
    const lastMove = replayStep > 0 ? replayMoves[replayStep - 1] : null; // חדש: המהלך האחרון המוצג

    const grid = document.getElementById("replay-grid"); // חדש: תופס את הלוח הגדול שנוצר ב-showGameBoard
    grid.innerHTML = ""; // חדש: מנקה את הציור הקודם לפני שמציירים מחדש

    boards.forEach((cells, boardIdx) => { // חדש: עובר על כל אחד מ-9 הלוחות הקטנים (boardIdx = מספר הלוח הקטן)
        const small = document.createElement("div"); // יוצר div ללוח קטן
        small.className = "viewer-small"; // נותן לו את מחלקת העיצוב של לוח קטן

        // התאים של הלוח הקטן (תמיד קיימים מתחת, גם אם הלוח נוצח)
        cells.forEach((v, cellIdx) => { // שונה: עובר על 9 התאים של הלוח הקטן (v = הערך בתא, cellIdx = מספר התא בתוך הלוח)
            const cell = document.createElement("div"); // יוצר div לתא
            cell.className = "viewer-cell"; // נותן לו את מחלקת העיצוב של תא
            if (v !== 0) cell.appendChild(makeImg(replaySkin[v], "viewer-mark")); // אם התא לא ריק - מוסיף לתוכו את תמונת השחקן המתאים
            // חדש: אם זה התא של המהלך האחרון - מוסיף לו מסגרת מודגשת
            if (lastMove && lastMove.id === boardIdx * 9 + cellIdx) cell.classList.add("viewer-last"); // חדש: מספר הכפתור = לוח*9 + תא
            small.appendChild(cell); // מוסיף את התא ללוח הקטן
        }); // סוף הלולאה על התאים

        // אם הלוח הקטן נוצח - שכבה עם איקס/עיגול גדול מעל התאים.
        // בהובר (ראה .viewer-overlay:hover ב-CSS) השכבה נעלמת ורואים מה היה בלוח לפני הניצחון - זה הבונוס
        const w = smallWinner(cells); // בודק מי ניצח בלוח הקטן הזה (0 אם אף אחד)
        if (w !== 0) { // אם יש מנצח
            const overlay = document.createElement("div"); // יוצר div לשכבת הניצחון
            overlay.className = "viewer-overlay"; // נותן לה את מחלקת השכבה
            overlay.appendChild(makeImg(replaySkin[w], "viewer-mark")); // שם בתוכה את תמונת המנצח
            small.appendChild(overlay); // מוסיף את השכבה מעל התאים בלוח הקטן
        } // סוף הבדיקה אם יש מנצח
        grid.appendChild(small); // מוסיף את הלוח הקטן ללוח הגדול
    }); // סוף הלולאה על הלוחות הקטנים

    // חדש: מעדכן את המונה (למשל "Move 5 / 30")
    document.getElementById("replay-counter").textContent = `Move ${replayStep} / ${replayMoves.length}`; // חדש: כמה מהלכים מוצגים מתוך כמה יש בסך הכל

    // חדש: משבית כפתורים שאין להם מה לעשות: אי אפשר לחזור אחורה מהלוח הריק, ואי אפשר להתקדם מהלוח הסופי
    document.getElementById("replay-start").disabled = (replayStep === 0); // חדש: אם אנחנו כבר בהתחלה - "Start" מושבת
    document.getElementById("replay-prev").disabled = (replayStep === 0); // חדש: אם אנחנו כבר בהתחלה - "Prev" מושבת
    document.getElementById("replay-next").disabled = (replayStep >= replayMoves.length); // חדש: אם הגענו לסוף - "Next" מושבת
} // חדש: סוף הפונקציה renderReplay

// חדש: כפתור "Start" - חוזר ללוח הריק (אפס מהלכים)
function replayStart() { // חדש: מגדיר את הפונקציה
    replayStep = 0; // חדש: אפס מהלכים מוצגים
    renderReplay(); // חדש: מצייר מחדש
} // חדש: סוף הפונקציה replayStart

// חדש: כפתור "Prev" - חוזר מהלך אחד אחורה (לא יורד מתחת ל-0)
function replayPrev() { // חדש: מגדיר את הפונקציה
    if (replayStep > 0) replayStep--; // חדש: מוריד מהלך אחד, רק אם יש מה להוריד
    renderReplay(); // חדש: מצייר מחדש
} // חדש: סוף הפונקציה replayPrev

// חדש: כפתור "Next" - מתקדם מהלך אחד קדימה (לא עולה מעל מספר המהלכים)
function replayNext() { // חדש: מגדיר את הפונקציה
    if (replayStep < replayMoves.length) replayStep++; // חדש: מוסיף מהלך אחד, רק אם עוד לא הגענו לסוף
    renderReplay(); // חדש: מצייר מחדש
} // חדש: סוף הפונקציה replayNext