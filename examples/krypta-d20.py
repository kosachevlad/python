"""Крипта d20 — мініпригода для Кодика v1.23+ та звичайного Python із Tkinter.

Запусти файл, обери клас героя й натисни «Почати пригоду».
Це спрощена авторська гра в дусі настільних RPG, а не офіційні правила D&D.
"""
import random
import textwrap
import tkinter as tk

CLASSES = {
    "warrior": {"name": "Воїн", "hp": 34, "attack": 5, "armor": 13,
                "die": 8, "bonus": 3, "skill": "Потужний удар"},
    "rogue": {"name": "Розбійник", "hp": 28, "attack": 6, "armor": 14,
              "die": 6, "bonus": 2, "skill": "Засідка"},
    "mage": {"name": "Маг", "hp": 24, "attack": 4, "armor": 12,
             "die": 8, "bonus": 3, "skill": "Вогняна куля"},
}
ROOMS = [
    {"name": "Брама", "enemy": "Гоблін", "hp": 10, "armor": 10,
     "attack": 2, "die": 4, "bonus": 1, "gold": 8, "art": "goblin",
     "story": "За іржавою брамою гоблін охороняє вхід до крипти."},
    {"name": "Кістяна зала", "enemy": "Скелет", "hp": 14, "armor": 12,
     "attack": 3, "die": 6, "bonus": 1, "gold": 12, "art": "skeleton",
     "story": "Кістки складаються в скелета. Його меч перегородив шлях!"},
    {"name": "Старий міст", "enemy": "Кам'яний вартовий", "hp": 18, "armor": 13,
     "attack": 4, "die": 6, "bonus": 2, "gold": 16, "art": "guardian",
     "story": "Над прірвою стоїть вартовий. Обійти його неможливо."},
    {"name": "Сховище", "enemy": "Дракончик", "hp": 24, "armor": 14,
     "attack": 5, "die": 8, "bonus": 2, "gold": 30, "art": "dragon",
     "story": "Серед монет спить дракончик. Поруч сяє Кристал ранку."},
]


class Adventure:
    """Правила гри відокремлені від інтерфейсу: їх легко змінювати й тестувати."""
    def __init__(self, rng=None):
        self.rng = rng or random
        self.choice = "warrior"
        self.reset()

    def reset(self):
        self.phase = "ready"
        self.hero = None
        self.enemy = None
        self.room = 0
        self.gold = 0
        self.potions = 3
        self.charges = 2
        self.turns = 0
        self.rested = False
        self.searched = False
        self.dice = "d20 — двадцятигранний кубик"
        self.logs = ["Знайди Кристал ранку в останній кімнаті.",
                     "Обери клас: воїн витривалий, маг має сильну магію."]

    def say(self, text):
        self.logs.append(text)
        self.logs = self.logs[-40:]

    def start(self, name, choice=None):
        if choice in CLASSES:
            self.choice = choice
        self.reset()
        self.hero = dict(CLASSES[self.choice])
        self.hero["title"] = name.strip()[:18] or "Мандрівник"
        self.hero["max_hp"] = self.hero["hp"]
        self.logs = []
        self.say(self.hero["title"] + " вирушає по Кристал ранку.")
        self.enter_room()

    def enter_room(self):
        self.enemy = dict(ROOMS[self.room])
        self.enemy["max_hp"] = self.enemy["hp"]
        self.phase = "combat"
        self.rested = self.searched = False
        self.dice = "Твій хід. Атакуй, застосуй уміння або захищайся."
        self.say("Кімната %d: %s." % (self.room + 1, self.enemy["name"]))

    def enemy_turn(self, guarded=False):
        if self.phase != "combat":
            return
        roll = self.rng.randint(1, 20)
        if guarded:
            roll = min(roll, self.rng.randint(1, 20))
        self.dice += " | Ворог: %d" % roll
        if roll == 1 or (roll != 20 and roll + self.enemy["attack"] < self.hero["armor"]):
            self.say(self.enemy["enemy"] + " промахується.")
            return
        damage = self.rng.randint(1, self.enemy["die"]) + self.enemy["bonus"]
        if roll == 20:
            damage += self.rng.randint(1, self.enemy["die"])
        if guarded:
            damage = max(1, damage // 2)
        self.hurt(damage, self.enemy["enemy"] + " завдає %d шкоди.")

    def hurt(self, damage, message):
        self.hero["hp"] = max(0, self.hero["hp"] - damage)
        self.say(message % damage)
        if self.hero["hp"] == 0:
            self.phase = "lost"
            self.say("Герой вибув. Почни нову пригоду — скарб ще чекає!")

    def damage_enemy(self, damage):
        self.enemy["hp"] = max(0, self.enemy["hp"] - damage)
        if self.enemy["hp"] > 0:
            return False
        self.gold += self.enemy["gold"]
        self.charges = min(2, self.charges + 1)
        self.say("Перемога над ворогом! +%d монет." % self.enemy["gold"])
        if self.room == len(ROOMS) - 1:
            self.phase = "won"
            self.say("Кристал ранку твій! Пригоду завершено.")
        else:
            self.phase = "camp"
            self.say("Можна перепочити, обшукати залу або йти далі.")
        return True

    def attack(self, special=False):
        if self.phase != "combat":
            return
        if special and self.charges == 0:
            self.say("Уміння вичерпано. Заряд повернеться після перемоги.")
            return
        self.turns += 1
        if special:
            self.charges -= 1
        if special and self.choice == "mage":
            damage = self.rng.randint(1, 6) + self.rng.randint(1, 6) + 4
            self.dice = "Вогняна куля: 2d6 + 4 = %d" % damage
            self.say("Вогняна куля влучає: %d шкоди!" % damage)
            if not self.damage_enemy(damage):
                self.enemy_turn()
            return
        roll = self.rng.randint(1, 20)
        if special and self.choice == "rogue":
            roll = max(roll, self.rng.randint(1, 20))
        modifier = self.hero["attack"] - (2 if special and self.choice == "warrior" else 0)
        self.dice = "Ти: d20=%d + %d проти броні %d" % (roll, modifier, self.enemy["armor"])
        if roll == 1 or (roll != 20 and roll + modifier < self.enemy["armor"]):
            self.say("Твій удар не влучив.")
            self.enemy_turn()
            return
        damage = self.rng.randint(1, self.hero["die"]) + self.hero["bonus"]
        if roll == 20:
            damage += self.rng.randint(1, self.hero["die"])
            self.say("КРИТИЧНИЙ УДАР! На d20 випало 20.")
        if special:
            damage += 4
        self.say("Ти завдаєш %d шкоди." % damage)
        if not self.damage_enemy(damage):
            self.enemy_turn()

    def guard(self):
        if self.phase != "combat":
            return
        self.turns += 1
        self.dice = "Захист: ворог кидає два d20 й бере менший."
        self.say("Ти прикриваєшся: отримана шкода зменшується вдвічі.")
        self.enemy_turn(guarded=True)

    def drink(self):
        if self.phase != "combat" or not self.potions:
            return
        if self.hero["hp"] == self.hero["max_hp"]:
            self.say("Здоров'я повне — збережи зілля.")
            return
        self.turns += 1
        self.potions -= 1
        healed = min(12, self.hero["max_hp"] - self.hero["hp"])
        self.hero["hp"] += healed
        self.dice = "Зілля відновлює %d здоров'я." % healed
        self.say("Ти випиваєш зілля: +%d здоров'я." % healed)
        self.enemy_turn()

    def rest(self):
        if self.phase != "camp" or self.rested:
            return
        self.rested = True
        healed = min(self.rng.randint(1, 6) + 4, self.hero["max_hp"] - self.hero["hp"])
        self.hero["hp"] += healed
        self.dice = "Короткий перепочинок: +%d здоров'я." % healed
        self.say("Перепочинок біля факела: +%d здоров'я." % healed)

    def search(self):
        if self.phase != "camp" or self.searched:
            return
        self.searched = True
        roll = self.rng.randint(1, 20)
        self.dice = "Обшук зали: d20=%d, потрібно 10." % roll
        if roll >= 10:
            self.gold += 10
            self.potions += 1
            self.say("Знайдено схованку: +10 монет і +1 зілля!")
        else:
            self.hurt(self.rng.randint(1, 4), "Пастка! Ти втрачаєш %d здоров'я.")

    def next_room(self):
        if self.phase != "camp":
            return
        self.room += 1
        self.enter_room()


BG = "#101827"
CARD = "#1a263b"
TEXT = "#e6edf7"
MUTED = "#a3b4ce"
GOLD = "#f6c768"
BLUE = "#63d8e8"
RED = "#ff7d86"
GREEN = "#8ce0a8"

SPRITES = {
    "hero": ["..HHH...", "..SSS.W.", ".AAAASW.", ".AAAA.W.", "..AA..W.", ".AAAA.W.", ".A..A...", ".A..A..."],
    "goblin": ["G....G..", ".GGGG...", "GKGKGG..", ".GGGG...", "..GG..W.", ".GGGG.W.", ".G..G.W.", "GG..GG.."],
    "skeleton": ["..BBBB..", ".BKBKB..", "..BBBB..", "...B..W.", ".BBBB.W.", "...B..W.", "..B.B...", ".BB.BB.."],
    "guardian": [".RRRRRR.", ".RKRKR..", ".RRRRRR.", "..RRRR..", ".RRRRRR.", "RRRRRRRR", "..RRRR..", ".RR..RR."],
    "dragon": ["D.....D.", ".DDDDD..", "DKDDKD..", ".DDDDD..", "D.DDD.DD", "DDDDDDD.", "..DDD...", ".DD.DD.."],
}
PALETTE = {"H": GOLD, "S": "#e6b28d", "A": "#7cb7f2", "W": "#e4edf6",
           "G": "#7bc884", "K": "#101827", "B": "#e7ddbb", "R": "#8796b1", "D": "#cf7eaa"}


class DungeonUI:
    def __init__(self, root, game=None):
        self.root = root
        self.game = game or Adventure()
        root.title("Крипта d20 — тестова пригода")
        root.geometry("360x760")
        root.configure(bg=BG)
        self.label("КРИПТА d20", 20, GOLD, bold=True).pack(pady=5)
        self.label("Чотири кімнати. Один легендарний скарб.", 10, MUTED).pack(pady=3)

        self.name = tk.Entry(root, width=26, bg=CARD, fg=TEXT, font=("Arial", 12))
        self.name.insert(0, "Мандрівник")
        self.name.pack(pady=5)

        choices = tk.Frame(root, bg=BG)
        choices.pack(pady=4)
        self.class_buttons = {}
        for key, values in CLASSES.items():
            button = self.button(choices, values["name"], lambda key=key: self.choose(key), width=12)
            button.pack(side=tk.LEFT, padx=2)
            self.class_buttons[key] = button

        self.stats = self.label("", 11, TEXT)
        self.stats.pack(pady=6)
        self.scene = tk.Canvas(root, width=328, height=165, bg=CARD, highlightthickness=0)
        self.scene.pack(pady=5)
        self.story = self.label("", 11, GOLD)
        self.story.pack(pady=5)
        self.enemy = self.label("", 11, RED)
        self.enemy.pack(pady=3)
        self.dice = self.label("", 10, BLUE)
        self.dice.pack(pady=5)

        row1 = tk.Frame(root, bg=BG)
        row1.pack(pady=3)
        self.attack_button = self.button(row1, "Атакувати", lambda: self.act("attack"))
        self.attack_button.pack(side=tk.LEFT, padx=3)
        self.skill_button = self.button(row1, "Уміння", lambda: self.act("attack", True))
        self.skill_button.pack(side=tk.LEFT, padx=3)

        row2 = tk.Frame(root, bg=BG)
        row2.pack(pady=3)
        self.potion_button = self.button(row2, "Випити зілля", lambda: self.act("drink"))
        self.potion_button.pack(side=tk.LEFT, padx=3)
        self.guard_button = self.button(row2, "Захищатися", lambda: self.act("guard"))
        self.guard_button.pack(side=tk.LEFT, padx=3)

        row3 = tk.Frame(root, bg=BG)
        row3.pack(pady=3)
        self.rest_button = self.button(row3, "Перепочити", lambda: self.act("rest"))
        self.rest_button.pack(side=tk.LEFT, padx=3)
        self.search_button = self.button(row3, "Обшукати", lambda: self.act("search"))
        self.search_button.pack(side=tk.LEFT, padx=3)

        self.next_button = self.button(root, "До наступної кімнати", lambda: self.act("next_room"), width=28)
        self.next_button.pack(pady=5)
        self.journal = self.label("", 10, MUTED)
        self.journal.pack(pady=6)
        self.start_button = self.button(root, "Почати пригоду", self.start_or_reset, width=28)
        self.start_button.pack(pady=5)
        self.refresh()

    def label(self, text, size=12, color=TEXT, bold=False):
        return tk.Label(self.root, text=text, fg=color, bg=BG,
                        font=("Arial", size, "bold" if bold else "normal"), wraplength=320)

    def button(self, parent, text, command, width=18):
        return tk.Button(parent, text=text, command=command, width=width,
                         font=("Arial", 12), bg=CARD, fg=TEXT)

    def choose(self, choice):
        if self.game.phase in ("ready", "won", "lost"):
            self.game.choice = choice
            self.refresh()

    def start_or_reset(self):
        if self.game.phase in ("ready", "won", "lost"):
            self.game.start(self.name.get(), self.game.choice)
        else:
            self.game.reset()
        self.refresh()

    def act(self, method, *args):
        getattr(self.game, method)(*args)
        self.refresh()

    def refresh(self):
        g = self.game
        combat = g.phase == "combat"
        camp = g.phase == "camp"
        editable = g.phase in ("ready", "won", "lost")
        for key, button in self.class_buttons.items():
            selected = key == g.choice
            button.config(bg=GOLD if selected else CARD, fg=BG if selected else TEXT,
                          state=tk.NORMAL if editable else tk.DISABLED)
        self.name.config(state=tk.NORMAL if editable else tk.DISABLED)
        if g.hero:
            h = g.hero
            self.stats.config(text="%s · %s\nЗдоров'я %d/%d · Броня %d · Монети %d · Зілля %d" %
                              (h["title"], h["name"], h["hp"], h["max_hp"], h["armor"], g.gold, g.potions))
        else:
            role = CLASSES[g.choice]
            self.stats.config(text="%s: здоров'я %d · броня %d\nУміння: %s" %
                              (role["name"], role["hp"], role["armor"], role["skill"]))
        if g.phase == "ready":
            story = "Обери героя й увійди до крипти."
        elif g.phase == "won":
            story = "ПЕРЕМОГА! Кристал ранку твій."
        elif g.phase == "lost":
            story = "ПОРАЗКА. Нова пригода — новий шанс."
        elif camp:
            story = "Кімнату очищено. Підготуйся до наступного бою."
        else:
            story = ROOMS[g.room]["story"]
        self.story.config(text=textwrap.fill(story, 42))
        self.enemy.config(text=("%s · здоров'я %d/%d · броня %d" %
                         (g.enemy["enemy"], g.enemy["hp"], g.enemy["max_hp"], g.enemy["armor"])) if g.enemy else "")
        self.dice.config(text=textwrap.fill(g.dice, 45))
        self.journal.config(text="\n".join("• " + textwrap.fill(line, 45) for line in g.logs[-4:]))
        self.attack_button.config(state=tk.NORMAL if combat else tk.DISABLED)
        self.skill_button.config(text="Уміння (%d)" % g.charges, state=tk.NORMAL if combat and g.charges else tk.DISABLED)
        self.potion_button.config(state=tk.NORMAL if combat and g.potions and g.hero["hp"] < g.hero["max_hp"] else tk.DISABLED)
        self.guard_button.config(state=tk.NORMAL if combat else tk.DISABLED)
        self.rest_button.config(state=tk.NORMAL if camp and not g.rested else tk.DISABLED)
        self.search_button.config(state=tk.NORMAL if camp and not g.searched else tk.DISABLED)
        self.next_button.config(state=tk.NORMAL if camp else tk.DISABLED)
        self.start_button.config(text="Почати пригоду" if g.phase == "ready" else
                                 "Зіграти ще раз" if editable else "Нова пригода")
        self.draw_scene()

    def sprite(self, name, x, y, size=6):
        for row, line in enumerate(SPRITES[name]):
            for column, pixel in enumerate(line):
                if pixel in PALETTE:
                    self.scene.create_rectangle(x+column*size, y+row*size,
                                                x+(column+1)*size, y+(row+1)*size,
                                                fill=PALETTE[pixel], outline=PALETTE[pixel])

    def draw_scene(self):
        c, g = self.scene, self.game
        c.delete("all")
        c.create_rectangle(0, 0, 328, 165, fill=CARD, outline=CARD)
        for x in (8, 286):
            c.create_rectangle(x, 10, x+34, 118, fill="#25344c", outline="#3e4d67")
            for y in (34, 60, 86):
                c.create_line(x, y, x+34, y, fill="#3e4d67")
        c.create_rectangle(127, 18, 200, 117, fill="#0a1020", outline="#59647b", width=3)
        c.create_line(0, 118, 328, 118, fill="#59647b", width=2)
        for x in (58, 258):
            c.create_polygon(x, 40, x-6, 53, x, 59, x+6, 53, fill=GOLD, outline=GOLD)
            c.create_rectangle(x-2, 59, x+2, 76, fill="#8d6548", outline="#8d6548")
        if g.phase == "won":
            c.create_polygon(164, 42, 146, 67, 164, 94, 182, 67, fill=BLUE, outline=GOLD, width=2)
            c.create_text(164, 107, text="КРИСТАЛ РАНКУ", fill=GOLD, font=("Arial", 10, "bold"))
        else:
            self.sprite("hero", 65, 65)
            if g.enemy and g.phase in ("combat", "lost"):
                self.sprite(g.enemy["art"], 218, 65)
                c.create_text(164, 90, text="VS", fill=GOLD, font=("Arial", 13, "bold"))
            elif g.phase == "camp":
                c.create_rectangle(225, 86, 263, 111, fill="#ad793f", outline=GOLD, width=2)
                c.create_rectangle(241, 91, 247, 101, fill=GOLD, outline=GOLD)
        for index, x in enumerate((45, 124, 203, 282)):
            if index:
                c.create_line(x-65, 137, x-12, 137, fill="#59647b", width=2)
            fill = GOLD if g.phase == "won" or index < g.room else BLUE if index == g.room else "#25344c"
            c.create_oval(x-10, 127, x+10, 147, fill=fill, outline=GOLD if index == g.room else "#59647b")
            c.create_text(x, 137, text=str(index+1), fill=BG if fill != "#25344c" else MUTED, font=("Arial", 10, "bold"))
        c.create_text(164, 157, text="Шлях до скарбу · 4 кімнати", fill=MUTED, font=("Arial", 9))


if __name__ == "__main__":
    window = tk.Tk()
    app = DungeonUI(window)
    window.mainloop()
