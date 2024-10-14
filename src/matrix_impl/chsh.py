from qrandom import qrng


def my_stategy(inp: bool) -> bool: 
    return inp

def eve_stategy(inp: bool) -> bool:
    return inp

def won(a:bool,b:bool,x:bool,y:bool):
    return a and b == x ^ y

def chsh():
    # a and b
    a = qrng()
    b = qrng()

    x=my_stategy(a)
    y=my_stategy(b)

    return won(a,b,x,y)