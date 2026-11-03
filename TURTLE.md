Підтримка turtle у Кодику

Приклад: examples/turtle-square.py. Кнопка «Запустити» показує полотно з малюнком біля результату виконання. Повторний запуск очищає малюнок. Поширення PNG включає полотно.

Підтримано основний навчальний API: Turtle, Screen, forward/backward, right/left, goto, setheading, penup/pendown, color/pencolor/fillcolor, pensize, speed, circle, dot, begin_fill/end_fill, write, clear/reset, hide/show, shape, bgcolor, setup, tracer, done. Також доступні команди через turtle.forward(...) та from turtle import *.

Це сумісна з браузером реалізація основних команд turtle, а не Tkinter. Обробники подій клавіатури, миші та таймерів поки не підтримуються й повідомляють про це. done() завершує програму, залишаючи малюнок на полотні.
