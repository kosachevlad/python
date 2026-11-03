"""Кіт і лабіринт — клавіатура, миша, екранні кнопки та таймери tkinter.

Працює в Кодику v1.23+ (APK 1.2+) і звичайному Python із Tkinter.
Стрілки/WASD: один крок. Клік по коридору: кіт іде до вибраної клітинки.
Спершу знайди мишку, потім виведи обох через двері.
"""
import random
from collections import deque
import tkinter as tk

DIRECTIONS = ((1, 0), (-1, 0), (0, 1), (0, -1))


class MazeState:
    """Логіка лабіринту без графічного інтерфейсу."""
    def __init__(self, seed=None):
        self.rng = random.Random(seed)
        self.total_steps = 0
        self.new_level(1)

    def new_level(self, level):
        if level not in (1, 2, 3):
            raise ValueError("Рівень має бути від 1 до 3")
        self.level = level
        self.size = 11 + level * 2
        self.grid = [[1 for _ in range(self.size)] for _ in range(self.size)]
        self.cat = (1, 1)
        self.grid[1][1] = 0
        stack = [self.cat]
        while stack:
            x, y = stack[-1]
            choices = []
            for dx, dy in DIRECTIONS:
                nx, ny = x + dx * 2, y + dy * 2
                if 1 <= nx < self.size - 1 and 1 <= ny < self.size - 1 and self.grid[ny][nx]:
                    choices.append((nx, ny, dx, dy))
            if not choices:
                stack.pop()
                continue
            nx, ny, dx, dy = self.rng.choice(choices)
            self.grid[y + dy][x + dx] = 0
            self.grid[ny][nx] = 0
            stack.append((nx, ny))
        self.exit = (self.size - 2, self.size - 1)
        self.grid[self.exit[1]][self.exit[0]] = 0
        self.caught = False
        self.companion = None
        self.won = False
        self.steps = 0
        distances = self.distances(self.cat)
        farthest = max(distances.values())
        self.mouse = self.rng.choice([p for p, distance in distances.items() if distance == farthest])

    def walkable(self, position, allow_locked=False):
        x, y = position
        if not (0 <= x < self.size and 0 <= y < self.size):
            return False
        if self.grid[y][x]:
            return False
        return position != self.exit or self.caught or allow_locked

    def distances(self, start):
        distances = {start: 0}
        queue = deque([start])
        while queue:
            x, y = queue.popleft()
            for dx, dy in DIRECTIONS:
                nxt = (x + dx, y + dy)
                if nxt not in distances and self.walkable(nxt):
                    distances[nxt] = distances[(x, y)] + 1
                    queue.append(nxt)
        return distances

    def route_to(self, target):
        if not self.walkable(target):
            return None
        previous = {self.cat: None}
        queue = deque([self.cat])
        while queue:
            current = queue.popleft()
            if current == target:
                route = []
                while previous[current] is not None:
                    route.append(current)
                    current = previous[current]
                return list(reversed(route))
            x, y = current
            for dx, dy in DIRECTIONS:
                nxt = (x + dx, y + dy)
                if nxt not in previous and self.walkable(nxt):
                    previous[nxt] = current
                    queue.append(nxt)
        return None

    def move(self, dx, dy):
        if abs(dx) + abs(dy) != 1:
            raise ValueError("Можна рухатися лише на одну клітинку")
        if self.won:
            return "finished"
        old = self.cat
        target = (old[0] + dx, old[1] + dy)
        if target == self.exit and not self.caught:
            return "locked"
        if not self.walkable(target):
            return "wall"
        self.cat = target
        self.steps += 1
        self.total_steps += 1
        if self.caught:
            self.companion = old
        if target == self.mouse and not self.caught:
            self.caught = True
            self.companion = old
            return "caught"
        if target == self.exit:
            self.won = True
            return "won"
        return "moved"

    def restart(self):
        self.total_steps = 0
        self.new_level(1)


BG = "#101c2d"
FLOOR = "#142a3d"
WALL = "#36546d"
TEXT = "#e6f0fa"
MUTED = "#a4bad0"
AQUA = "#67dce6"
GOLD = "#ffd27d"
ORANGE = "#ffb86a"
GREEN = "#8ee6b0"
LOCKED = "#b99be9"


class CatMazeUI:
    def __init__(self, root, game=None):
        self.root = root
        self.game = game or MazeState()
        self.delay = 85
        self.timer = None
        self.route = []
        self.route_dots = []
        self.cat_drawn = None
        self.friend_drawn = None
        root.title("Кіт і лабіринт")
        available = root.winfo_width()
        root.geometry("%dx700" % (available if available > 200 else 400))
        root.configure(bg=BG)
        self.label("КІТ І ЛАБІРИНТ", 19, GOLD, True).pack(pady=6)
        self.label("Знайди мишку й виведи її на волю", 11, MUTED).pack(pady=3)
        self.stats = self.label("", 12)
        self.stats.pack(pady=6)
        self.canvas = tk.Canvas(root, width=286, height=286, bg=FLOOR, highlightthickness=0)
        self.canvas.pack(pady=5)
        self.message = self.label("", 12, AQUA)
        self.message.pack(pady=6)
        self.label("Стрілки / WASD — рух\nКлік по коридору — маршрут до клітинки", 10, MUTED).pack(pady=4)

        pad = tk.Frame(root, bg=BG)
        pad.pack(pady=3)
        self.arrows = {}
        for text, dx, dy, row, column in (
            ("↑", 0, -1, 0, 1), ("←", -1, 0, 1, 0),
            ("↓", 0, 1, 1, 1), ("→", 1, 0, 1, 2)
        ):
            button = tk.Button(pad, text=text, width=5, font=("Arial", 16, "bold"),
                               bg="#203b54", fg=TEXT, pady=12,
                               command=lambda dx=dx, dy=dy: self.manual_move(dx, dy))
            button.grid(row=row, column=column, padx=3, pady=3)
            self.arrows[(dx, dy)] = button

        actions = tk.Frame(root, bg=BG)
        actions.pack(pady=6)
        self.new_button = tk.Button(actions, text="Нова гра", width=13, bg="#203b54", fg=TEXT,
                                    font=("Arial", 12), command=self.restart)
        self.new_button.pack(side=tk.LEFT, padx=3)
        self.next_button = tk.Button(actions, text="Наступний рівень", width=17, bg="#203b54", fg=TEXT,
                                     font=("Arial", 12), command=self.next_level)
        self.next_button.pack(side=tk.LEFT, padx=3)
        root.bind("<Key>", self.on_key)
        self.canvas.bind("<Button-1>", self.on_click)
        self.canvas.bind("<Motion>", self.on_motion)
        self.draw_board()
        self.focus_game()

    def label(self, text, size, color=TEXT, bold=False):
        return tk.Label(self.root, text=text, fg=color, bg=BG, wraplength=310,
                        font=("Arial", size, "bold" if bold else "normal"))

    def focus_game(self):
        # A real focusable button also makes keyboard control work in a browser.
        self.new_button.focus_set()

    def cancel_route(self):
        if self.timer is not None:
            self.root.after_cancel(self.timer)
            self.timer = None
        self.route = []
        self.route_dots = []
        self.canvas.delete("route")

    def restart(self):
        self.cancel_route()
        self.game.restart()
        self.draw_board()
        self.focus_game()

    def next_level(self):
        if not self.game.won or self.game.level == 3:
            return
        self.cancel_route()
        self.game.new_level(self.game.level + 1)
        self.draw_board()
        self.focus_game()

    def draw_board(self):
        g, c = self.game, self.canvas
        self.cell = 288 // g.size
        self.board_size = self.cell * g.size
        c.config(width=self.board_size, height=self.board_size)
        c.delete("all")
        for y, row in enumerate(g.grid):
            for x, wall in enumerate(row):
                color = WALL if wall else FLOOR
                c.create_rectangle(x*self.cell, y*self.cell, (x+1)*self.cell, (y+1)*self.cell,
                                   fill=color, outline=BG if wall else color)
        x, y = g.exit
        self.door = c.create_rectangle(x*self.cell+2, y*self.cell+1,
                                       (x+1)*self.cell-2, (y+1)*self.cell-1,
                                       fill=LOCKED, outline=GOLD, width=2)
        c.create_text((x+0.5)*self.cell, (y+0.5)*self.cell, text="В",
                      fill=BG, font=("Arial", max(9, self.cell//2), "bold"))
        self.draw_mouse(g.mouse, "mouse")
        self.draw_cat(g.cat)
        self.cat_drawn = g.cat
        self.friend_drawn = None
        self.hover_xy = (-1000, -1000)
        d = self.cell - 4
        for a,b,d1,e in ((0,0,d,0),(d,0,d,d),(d,d,0,d),(0,d,0,0)):
            c.create_line(-1000+a, -1000+b, -1000+d1, -1000+e,
                          fill=AQUA, width=2, tags="hover")
        self.update_status("Спочатку знайди мишку. Фіолетові двері поки замкнені.")

    def draw_cat(self, position):
        x, y = position
        c, s = self.canvas, self.cell
        def p(a, b):
            return (x*s+a*s/22, y*s+b*s/22)
        def oval(a, b, d, e, color):
            c.create_oval(*p(a,b), *p(d,e), fill=color, outline=color, tags="cat")
        c.create_line(*p(16,17), *p(21,18), *p(21,11), fill=ORANGE, width=max(2,s/8), tags="cat")
        oval(5,10,18,21,ORANGE)
        oval(3,3,19,16,ORANGE)
        for coords in ((4,7,4,0,10,4),(12,4,18,0,18,7)):
            c.create_polygon(*[value for a,b in zip(coords[::2],coords[1::2]) for value in p(a,b)],
                             fill=ORANGE, outline=ORANGE, tags="cat")
        oval(7,7,9,10,BG)
        oval(14,7,16,10,BG)
        c.create_polygon(*p(9,11), *p(13,11), *p(11,13), fill="#e87893", outline="#e87893", tags="cat")
        for a,b,d,e in ((1,10,6,11),(1,13,6,12),(16,11,21,10),(16,12,21,13)):
            c.create_line(*p(a,b), *p(d,e), fill="#fbe6bf", width=1, tags="cat")
        c.create_line(*p(9,17), *p(14,17), fill="#d58242", width=2, tags="cat")

    def draw_mouse(self, position, tag):
        x, y = position
        s = self.cell
        c = self.canvas
        def p(a,b):
            return (x*s+a*s/22,y*s+b*s/22)
        c.create_line(*p(15,15), *p(21,18), *p(20,21), fill="#e79caf", width=2, tags=tag)
        c.create_oval(*p(5,8), *p(18,19), fill="#d5e0e9", outline="#98afc3", tags=tag)
        c.create_oval(*p(3,3), *p(10,11), fill="#a9bccd", outline="#d5e0e9", tags=tag)
        c.create_oval(*p(12,3), *p(19,11), fill="#a9bccd", outline="#d5e0e9", tags=tag)
        c.create_oval(*p(7,8), *p(15,16), fill="#d5e0e9", outline="#d5e0e9", tags=tag)
        c.create_oval(*p(8,10), *p(10,12), fill=BG, outline=BG, tags=tag)
        c.create_polygon(*p(10,15), *p(13,15), *p(11.5,17), fill="#e79caf", outline="#e79caf", tags=tag)

    def sync_entities(self):
        g, c, s = self.game, self.canvas, self.cell
        c.move("cat", (g.cat[0]-self.cat_drawn[0])*s, (g.cat[1]-self.cat_drawn[1])*s)
        self.cat_drawn = g.cat
        if g.caught:
            c.delete("mouse")
            c.itemconfig(self.door, fill=GREEN)
            if self.friend_drawn is None:
                self.draw_mouse(g.companion, "friend")
            else:
                c.move("friend", (g.companion[0]-self.friend_drawn[0])*s,
                       (g.companion[1]-self.friend_drawn[1])*s)
            self.friend_drawn = g.companion

    def update_status(self, text=None):
        g = self.game
        self.stats.config(text="Рівень %d/3 · Кроки: %d · Мишка: %s" %
                          (g.level, g.steps, "з тобою" if g.caught else "шукаємо"))
        if text:
            self.message.config(text=text)
        self.next_button.config(state=tk.NORMAL if g.won and g.level < 3 else tk.DISABLED)
        for button in self.arrows.values():
            button.config(state=tk.DISABLED if g.won else tk.NORMAL)

    def step(self, dx, dy):
        result = self.game.move(dx, dy)
        if result in ("wall", "locked"):
            self.update_status("Тут стіна — обери інший напрямок." if result == "wall" else
                               "Спочатку піймай мишку, щоб відкрити вихід.")
            return
        self.sync_entities()
        if result == "caught":
            text = "Мишка з тобою! Тепер шукай зелені двері."
        elif result == "won":
            text = ("Ви на волі! Усі три лабіринти пройдено." if self.game.level == 3 else
                    "Ви на волі! Можна перейти до наступного рівня.")
        elif result == "finished":
            return
        else:
            text = "До зелених дверей!" if self.game.caught else "Знайди мишку серед коридорів."
        self.update_status(text)

    def manual_move(self, dx, dy):
        self.cancel_route()
        self.step(dx, dy)
        self.focus_game()

    def on_key(self, event):
        keys = {
            "Up":(0,-1), "ArrowUp":(0,-1), "w":(0,-1), "ц":(0,-1),
            "Down":(0,1), "ArrowDown":(0,1), "s":(0,1), "і":(0,1),
            "Left":(-1,0), "ArrowLeft":(-1,0), "a":(-1,0), "ф":(-1,0),
            "Right":(1,0), "ArrowRight":(1,0), "d":(1,0), "в":(1,0),
        }
        key = getattr(event, "keysym", "")
        direction = keys.get(key) or keys.get(key.lower())
        if direction:
            self.manual_move(*direction)
            return "break"

    def cell_from_event(self, event):
        # SVG in Kodik can shrink on a narrow phone. Account for its centered viewBox.
        width = max(1, self.canvas.winfo_width())
        height = max(1, self.canvas.winfo_height())
        scale = min(width/self.board_size, height/self.board_size)
        x = (event.x-(width-self.board_size*scale)/2)/scale
        y = (event.y-(height-self.board_size*scale)/2)/scale
        cell = (int(x//self.cell), int(y//self.cell))
        if 0 <= cell[0] < self.game.size and 0 <= cell[1] < self.game.size:
            return cell
        return None

    def on_motion(self, event):
        position = self.cell_from_event(event)
        if position is None:
            return
        x, y = position[0]*self.cell+2, position[1]*self.cell+2
        self.canvas.move("hover", x-self.hover_xy[0], y-self.hover_xy[1])
        self.hover_xy = (x,y)
        self.canvas.itemconfig("hover", fill=AQUA if self.game.walkable(position) else "#cd8799")

    def on_click(self, event):
        self.cancel_route()
        self.focus_game()
        if self.game.won:
            return
        target = self.cell_from_event(event)
        if target is None:
            return
        if target == self.game.exit and not self.game.caught:
            self.update_status("Спочатку піймай мишку, щоб відкрити вихід.")
            return
        route = self.game.route_to(target)
        if route is None:
            self.update_status("Тут стіна. Натисни на клітинку коридору.")
            return
        if not route:
            self.update_status("Кіт уже тут.")
            return
        self.route = route
        s = self.cell
        for index,(x,y) in enumerate(route):
            dot = None
            if index < len(route)-1:
                dot = self.canvas.create_oval((x+0.4)*s,(y+0.4)*s,(x+0.6)*s,(y+0.6)*s,
                                              fill=AQUA,outline=AQUA,tags="route")
            self.route_dots.append(dot)
        self.update_status("Кіт іде до вибраної клітинки. Клавіша зупинить маршрут.")
        self.timer = self.root.after(self.delay, self.auto_step)

    def auto_step(self):
        self.timer = None
        if not self.route or self.game.won:
            return
        target = self.route.pop(0)
        dot = self.route_dots.pop(0)
        if dot is not None:
            self.canvas.delete(dot)
        x, y = self.game.cat
        self.step(target[0]-x,target[1]-y)
        if self.route and not self.game.won:
            self.timer = self.root.after(self.delay,self.auto_step)


if __name__ == "__main__":
    window = tk.Tk()
    app = CatMazeUI(window)
    window.mainloop()
