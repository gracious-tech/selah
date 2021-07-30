
import random


# Possible room names derived from praise in the Psalms
# NOTE Derived from NET Bible® http://netbible.com copyright ©1996, 2019
# NOTE Judgement praises removed ONLY because they'll be displayed out of context which is not wise
room_names = (
    # Psalm 104
    "Robed in splendor and majesty",
    "Stretches out the skies",
    "Established the earth",
    "Turns springs into streams",
    "Sing to the Lord",
    "Rejoice in the Lord",
    # Derived from Psalm 136
    "His love endures",
    "The Lord is good",
    "The God of gods",
    "The Lord of lords",
    "God does amazing deeds",
    "In wisdom made the heavens",
    "Made the sun to rule by day",
    "Made the moon to rule by night",
    "Remembers us when we are down",
    "Feeds all living things",
    "The God of heaven",
    # Derived from Psalm 150
    "Praise the Lord!",
    "Praise him with music",
)


def get_random_name():
    return random.choice(room_names)
