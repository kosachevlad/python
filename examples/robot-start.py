from robot import *

# Власна карта для команд із прикладу.
# @ — робот, * — кристал, A — стіна.
load_map_text("""direction:
north

map:
AAAAAAAAAAAAA
A           A
A           A
A @       * A
AAAAAAAAAAAAA
""")

forward(2)
right()
forward(8)
right()
forward()
pickUp()

print("Зібрано кристалів:", collected())
done()
