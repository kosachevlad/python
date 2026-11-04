from robot import *

load_map("map3.map")
skin("desert")
setSpeed(8)

# Пройдемо змійкою між стінами.
right()
forward(11)
right()
forward(2)
right()
forward(13)
left()
forward(2)
left()
forward(13)
right()
forward(2)
right()
forward(11)

if frontIsEnergon():
    pickUp()

print("Зібрано:", collected(), "із", EnergonTotal())
done()
