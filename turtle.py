"""Canvas-backed turtle for Kodik. Core drawing API; no Tk or window event loop."""
import math
import json
from js import kodikTurtle as _bridge

def _emit(command, **values):
    _bridge.enqueue(json.dumps(dict(op=command, **values)))

def _number(value):
    value = float(value)
    if not math.isfinite(value):
        raise ValueError("turtle: координата має бути скінченним числом")
    return value

_screen = None
_default = None
_turtles = []

class TurtleGraphicsError(Exception):
    pass

class _Screen:
    def __init__(self):
        self._mode = 1.0
        self._background = "white"
    def bgcolor(self, *args):
        if not args:
            return self._background
        self._background = _color(args)
        _emit("background", color=self._background)
    def colormode(self, mode=None):
        if mode is None:
            return self._mode
        if mode not in (1.0, 255):
            raise TurtleGraphicsError("colormode: очікується 1.0 або 255")
        self._mode = mode
    def title(self, text):
        _emit("title", text=str(text))
    def setup(self, width=640, height=480, startx=None, starty=None):
        # The canvas remains responsive; these set its logical drawing size.
        width = width * 640 if 0 < width <= 1 else width
        height = height * 480 if 0 < height <= 1 else height
        _emit("setup", width=max(100, min(2000, _number(width))), height=max(100, min(2000, _number(height))))
    def screensize(self, canvwidth=None, canvheight=None, bg=None):
        if bg is not None:
            self.bgcolor(bg)
        if canvwidth is not None or canvheight is not None:
            self.setup(canvwidth or 640, canvheight or 480)
    def tracer(self, n=None, delay=None):
        if n is not None:
            _emit("tracer", enabled=bool(n))
    def update(self):
        pass
    def mainloop(self):
        pass
    def bye(self):
        _emit("close")
    def clearscreen(self):
        _turtles.clear()
        global _default
        _default = None
        _emit("clear_all")
    clear = clearscreen
    def reset(self):
        for turtle in _turtles:
            turtle.reset()
    resetscreen = reset
    def window_width(self):
        return 640
    def window_height(self):
        return 480
    def onkey(self, *args, **kwargs):
        raise NotImplementedError("Події клавіатури turtle поки не підтримуються в Кодику")
    onkeypress = onkey
    onkeyrelease = onkey
    onclick = onkey
    ontimer = onkey
    def listen(self, *args, **kwargs):
        pass
    def exitonclick(self):
        pass

def Screen():
    global _screen
    if _screen is None:
        _screen = _Screen()
    return _screen

def _color(args):
    if len(args) == 1:
        value = args[0]
        if isinstance(value, str):
            if not _bridge.validColor(value):
                raise TurtleGraphicsError("Невідомий колір: " + value)
            return value
        args = tuple(value)
    if len(args) != 3:
        raise TurtleGraphicsError("Колір: назва або три компоненти RGB")
    scale = 255 / Screen()._mode
    components = [round(_number(v) * scale) for v in args]
    if any(v < 0 or v > 255 for v in components):
        raise TurtleGraphicsError("Компоненти кольору поза діапазоном colormode")
    return "#%02x%02x%02x" % tuple(components)

class Turtle:
    def __init__(self, shape="classic", undobuffersize=1000, visible=True):
        self._id = len(_turtles)
        _turtles.append(self)
        self._x = self._y = self._angle = 0.0
        self._down = True
        self._pen = self._fill = "black"
        self._width = 1
        self._speed = 3
        self._visible = bool(visible)
        self._shape = shape
        self._fill_points = None
        self._pose()
    def _pose(self):
        _emit("pose", id=self._id, x=self._x, y=self._y, angle=self._angle,
              color=self._pen, visible=self._visible, shape=self._shape)
    def forward(self, distance):
        distance = _number(distance)
        angle = math.radians(self._angle)
        self.goto(self._x + distance * math.cos(angle), self._y + distance * math.sin(angle))
    fd = forward
    def backward(self, distance):
        self.forward(-_number(distance))
    back = bk = backward
    def right(self, angle):
        self.setheading(self._angle - _number(angle))
    rt = right
    def left(self, angle):
        self.setheading(self._angle + _number(angle))
    lt = left
    def goto(self, x, y=None):
        if y is None:
            x, y = x
        x, y = _number(x), _number(y)
        _emit("move", id=self._id, x0=self._x, y0=self._y, x=x, y=y,
              draw=self._down, color=self._pen, width=self._width, speed=self._speed)
        self._x, self._y = x, y
        if self._fill_points is not None:
            self._fill_points.append([x, y])
    setpos = setposition = goto
    def setx(self, x):
        self.goto(x, self._y)
    def sety(self, y):
        self.goto(self._x, y)
    def setheading(self, angle):
        self._angle = _number(angle) % 360
        self._pose()
    seth = setheading
    def heading(self):
        return self._angle
    def position(self):
        return (self._x, self._y)
    pos = position
    def xcor(self):
        return self._x
    def ycor(self):
        return self._y
    def distance(self, x, y=None):
        if isinstance(x, Turtle):
            x, y = x.position()
        elif y is None:
            x, y = x
        return math.hypot(x-self._x, y-self._y)
    def towards(self, x, y=None):
        if isinstance(x, Turtle):
            x, y = x.position()
        elif y is None:
            x, y = x
        return math.degrees(math.atan2(y-self._y, x-self._x)) % 360
    def home(self):
        self.goto(0, 0)
        self.setheading(0)
    def penup(self):
        self._down = False
    up = pu = penup
    def pendown(self):
        self._down = True
    down = pd = pendown
    def isdown(self):
        return self._down
    def pensize(self, width=None):
        if width is None:
            return self._width
        width = _number(width)
        if width <= 0:
            raise TurtleGraphicsError("Товщина лінії має бути більшою за нуль")
        self._width = width
    width = pensize
    def pencolor(self, *args):
        if not args:
            return self._pen
        self._pen = _color(args)
        self._pose()
    def fillcolor(self, *args):
        if not args:
            return self._fill
        self._fill = _color(args)
    def color(self, *args):
        if not args:
            return (self._pen, self._fill)
        if len(args) == 2:
            self.pencolor(args[0])
            self.fillcolor(args[1])
        else:
            value = _color(args)
            self._pen = self._fill = value
            self._pose()
    def speed(self, speed=None):
        if speed is None:
            return self._speed
        names = {"fastest":0, "fast":10, "normal":6, "slow":3, "slowest":1}
        speed = names.get(speed, speed)
        speed = _number(speed)
        self._speed = round(speed) if 0.5 < speed < 10.5 else 0
    def hideturtle(self):
        self._visible = False
        self._pose()
    ht = hideturtle
    def showturtle(self):
        self._visible = True
        self._pose()
    st = showturtle
    def isvisible(self):
        return self._visible
    def shape(self, name=None):
        if name is None:
            return self._shape
        if name not in ("classic", "arrow", "turtle", "circle", "square", "triangle", "blank"):
            raise TurtleGraphicsError("Невідома форма черепашки: " + str(name))
        self._shape = name
        self._pose()
    def circle(self, radius, extent=None, steps=None):
        radius = _number(radius)
        extent = 360 if extent is None else _number(extent)
        steps = max(1, int(abs(extent)/6)+1) if steps is None else int(steps)
        if steps <= 0 or steps > 10000:
            raise TurtleGraphicsError("steps: очікується число від 1 до 10000")
        turn = extent / steps * (1 if radius >= 0 else -1)
        length = 2 * abs(radius) * math.sin(math.radians(abs(turn))/2)
        if extent < 0:
            length = -length
        self.left(turn/2)
        for _ in range(steps):
            self.forward(length)
            self.left(turn)
        self.right(turn/2)
    def dot(self, size=None, *color):
        size = max(self._width+4, self._width*2) if size is None else _number(size)
        _emit("dot", id=self._id, x=self._x, y=self._y, size=size,
              color=_color(color) if color else self._pen)
    def begin_fill(self):
        self._fill_points = [[self._x, self._y]]
    def end_fill(self):
        if self._fill_points is not None:
            _emit("fill", id=self._id, points=self._fill_points, color=self._fill)
            self._fill_points = None
    def filling(self):
        return self._fill_points is not None
    def write(self, arg, move=False, align="left", font=("Arial", 8, "normal")):
        _emit("write", id=self._id, x=self._x, y=self._y, text=str(arg), color=self._pen,
              align=align, size=max(1, _number(font[1])))
        if move:
            raise NotImplementedError("turtle.write(move=True) поки не підтримується")
    def clear(self):
        _emit("clear", id=self._id)
    def reset(self):
        self.clear()
        self._x = self._y = self._angle = 0.0
        self._down, self._pen, self._fill, self._width = True, "black", "black", 1
        self._speed, self._visible, self._fill_points = 3, True, None
        self._pose()
    def getscreen(self):
        return Screen()
    def onclick(self, *args, **kwargs):
        return Screen().onclick(*args, **kwargs)

Pen = RawTurtle = Turtle

def _default_turtle():
    global _default
    if _default is None:
        _default = Turtle()
    return _default

def _delegate(name):
    def method(*args, **kwargs):
        return getattr(_default_turtle(), name)(*args, **kwargs)
    method.__name__ = name
    return method

for _name in ("forward fd backward back bk right rt left lt goto setpos setposition setx sety "
              "setheading seth heading position pos xcor ycor distance towards home penup up pu "
              "pendown down pd isdown pensize width pencolor fillcolor color speed hideturtle ht "
              "showturtle st isvisible shape circle dot begin_fill end_fill filling write clear reset").split():
    globals()[_name] = _delegate(_name)

def _screen_delegate(name):
    def method(*args, **kwargs):
        return getattr(Screen(), name)(*args, **kwargs)
    return method

for _name in ("bgcolor colormode title setup screensize tracer update bye clearscreen resetscreen "
              "window_width window_height onkey onkeypress onkeyrelease onclick ontimer listen exitonclick").split():
    globals()[_name] = _screen_delegate(_name)

def done():
    pass

mainloop = done
__all__ = [name for name in globals() if not name.startswith("_") and name not in ("math", "json")]
