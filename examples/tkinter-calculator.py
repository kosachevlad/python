import tkinter as tk

window = tk.Tk()
window.title("Мій калькулятор")
window.geometry("320x300")

tk.Label(window, text="Перше число:").pack(pady=5)
first = tk.Entry(window)
first.pack()

tk.Label(window, text="Друге число:").pack(pady=5)
second = tk.Entry(window)
second.pack()

result = tk.Label(window, text="Введи два числа")
result.pack(pady=10)

def add_numbers():
    try:
        total = float(first.get()) + float(second.get())
        result.config(text=f"Сума: {total:g}", fg="blue")
    except ValueError:
        result.config(text="Введи саме числа", fg="red")

tk.Button(window, text="Додати", command=add_numbers).pack(pady=5)
window.mainloop()
