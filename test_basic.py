# Basic variable tracking
x = 10
y = 20
z = x + y

# Expression evaluation
[i**2 for i in range(5)]

# Function definition and call
def greet(name):
    return f"Hello, {name}!"

message = greet("World")
print(message)

# Loop with side effects
total = 0
for i in range(10):
    total += i

# Dictionary operations
data = {"a": 1, "b": 2}
data["c"] = 3
list(data.keys())
