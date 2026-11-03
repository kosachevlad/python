# Tkinter у Кодику

Браузерна реалізація навчального набору tkinter. Приклад: examples/tkinter-calculator.py.

Підтримано Tk/Toplevel, Label, Entry, Button, Frame/LabelFrame, Text, Checkbutton/Radiobutton, Scale, базовий Canvas; pack/grid/place; configure/config; get/insert/delete; StringVar/IntVar/DoubleVar/BooleanVar; command та базові bind; after/after_cancel; базові messagebox; ttk-аналоги основних віджетів. mainloop залишає інтерфейс активним у браузері. Вивід та помилки обробників кнопок показуються в терміналі.

Це не повний Tcl/Tk. Системні файлові діалоги, меню, PhotoImage, складні віджети ttk та повний набір параметрів Tk поки не підтримуються. Вікно вбудоване в область виконання. PNG поширення наразі включає текстовий вивід і turtle, але не знімок інтерфейсу tkinter.

Тест: запусти приклад, введи 7 і 5 та натисни «Додати» — отримаєш «Сума: 12». Для тексту замість числа з'явиться «Введи саме числа». Повторний запуск закриває старі вікна й таймери.
