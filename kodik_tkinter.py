"""Kodik's browser implementation of the classroom Tkinter widget API."""
import json as _json
import sys as _sys
import types as _types
import io as _io
import contextlib as _contextlib
import traceback as _traceback
from pyodide.ffi import create_proxy as _create_proxy
from js import KodikTk as _bridge

END="end"
INSERT="insert"
LEFT="left"
RIGHT="right"
TOP="top"
BOTTOM="bottom"
BOTH="both"
X="x"
Y="y"
N="n"
S="s"
E="e"
W="w"
NW="nw"
NE="ne"
SW="sw"
SE="se"
CENTER="center"
NORMAL="normal"
DISABLED="disabled"
HORIZONTAL="horizontal"
VERTICAL="vertical"
SUNKEN="sunken"
RAISED="raised"
FLAT="flat"
SOLID="solid"
RIDGE="ridge"
GROOVE="groove"
_default_root=None
_widgets={}
_proxies=[]
_proxy_cache={}
_counter=0

class TclError(Exception):
    pass

def _id(prefix="w"):
    global _counter
    _counter+=1
    return prefix+str(_counter)

def _proxy(callback, widget=None, event=False):
    key=(callback, widget, event)
    if key in _proxy_cache:
        return _proxy_cache[key]
    def invoke(payload="{}"):
        buffer=_io.StringIO()
        try:
            with _contextlib.redirect_stdout(buffer), _contextlib.redirect_stderr(buffer):
                if event:
                    values=_json.loads(str(payload))
                    values["widget"]=widget
                    result=callback(_types.SimpleNamespace(**values))
                else:
                    result=callback()
        except Exception as error:
            diagnostic = _sys.modules.get('_kodik_diagnostics')
            if diagnostic is not None:
                _bridge.appendOutput(diagnostic.report_exception(error))
            else:
                _bridge.appendOutput("❌ "+ "".join(_traceback.format_exception_only(type(error),error)))
            result=None
        if buffer.getvalue():
            _bridge.appendOutput(buffer.getvalue())
        return result if isinstance(result, (str,int,float,bool)) else None
    proxy=_create_proxy(invoke)
    _proxies.append(proxy)
    _proxy_cache[key]=proxy
    return proxy

def _cleanup():
    _bridge.reset()
    for proxy in _proxies:
        proxy.destroy()
    _proxies.clear()
    _proxy_cache.clear()

class Variable:
    default=""
    def __init__(self, master=None, value=None, name=None):
        self._id=name or _id("v")
        self.set(self.default if value is None else value)
    def get(self):
        return _bridge.getVar(self._id)
    def set(self, value):
        _bridge.setVar(self._id, value)
    def trace_add(self, mode, callback):
        if mode not in ("write","w"):
            raise NotImplementedError("У Кодику підтримано trace_add('write', ...)")
        proxy=_proxy(lambda:callback(self._id,"","write"))
        _bridge.watchVar(self._id,proxy)
        return self._id
    def __str__(self):
        return self._id

class StringVar(Variable):
    def get(self):
        return str(super().get())

class IntVar(Variable):
    default=0
    def get(self):
        return int(super().get())

class DoubleVar(Variable):
    default=0.0
    def get(self):
        return float(super().get())

class BooleanVar(Variable):
    default=False
    def get(self):
        return str(super().get()).lower() in ("1","true","yes","on")

def _options(options):
    return {key:(value._id if isinstance(value,Variable) else value)
            for key,value in options.items() if key not in ("command",) and not callable(value)}

class Widget:
    kind="Frame"
    def __init__(self, master=None, cnf=None, **kwargs):
        if master is None:
            master=_root()
        self.master=master
        self._id=_id()
        self.children={}
        self._config=dict(cnf or {})
        self._config.update(kwargs)
        _widgets[self._id]=self
        master.children[self._id]=self
        _bridge.create(self.kind,self._id,master._id,_json.dumps(_options(self._config)))
        self._command=None
        if "command" in self._config:
            self.configure(command=self._config["command"])
    def configure(self, cnf=None, **kwargs):
        values=dict(cnf or {})
        values.update(kwargs)
        self._config.update(values)
        if "command" in values:
            self._command=values["command"]
            _bridge.command(self._id,_proxy(self._command,self) if self._command else None)
        _bridge.configure(self._id,_json.dumps(_options(values)))
    config=configure
    def cget(self, key):
        return self._config.get(key)
    def __setitem__(self,key,value):
        self.configure(**{key:value})
    def __getitem__(self,key):
        return self.cget(key)
    def pack(self, cnf=None, **kwargs):
        values=dict(cnf or {});values.update(kwargs)
        _bridge.layout(self._id,"pack",_json.dumps(values))
    def grid(self, cnf=None, **kwargs):
        values=dict(cnf or {});values.update(kwargs)
        _bridge.layout(self._id,"grid",_json.dumps(values))
    def place(self, cnf=None, **kwargs):
        values=dict(cnf or {});values.update(kwargs)
        _bridge.layout(self._id,"place",_json.dumps(values))
    def pack_forget(self):
        _bridge.hide(self._id)
    grid_forget=grid_remove=place_forget=pack_forget
    def destroy(self):
        for child in list(self.children.values()):
            child.destroy()
        _bridge.destroy(self._id)
        _widgets.pop(self._id,None)
        if self.master:
            self.master.children.pop(self._id,None)
    def bind(self, sequence, func, add=None):
        _bridge.bind(self._id,sequence,_proxy(func,self,event=True),add=="+")
    def focus_set(self):
        _bridge.focus(self._id)
    focus=focus_force=focus_set
    def winfo_children(self):
        return list(self.children.values())
    def winfo_width(self):
        return int(_bridge.size(self._id,"width"))
    def winfo_height(self):
        return int(_bridge.size(self._id,"height"))
    def winfo_exists(self):
        return bool(_bridge.exists(self._id))
    def after(self, ms, func=None, *args):
        if func is None:
            raise NotImplementedError("after(ms) без функції блокує браузер; використай after(ms, callback)")
        callback=func if not args else lambda:func(*args)
        return int(_bridge.after(int(ms),_proxy(callback,self)))
    def after_cancel(self, timer):
        _bridge.cancelAfter(int(timer))
    def update(self):
        pass
    update_idletasks=update
    def mainloop(self, n=0):
        pass
    def quit(self):
        self.destroy()
    def rowconfigure(self,index,**kwargs):
        _bridge.track(self._id,"row",int(index),_json.dumps(kwargs))
    grid_rowconfigure=rowconfigure
    def columnconfigure(self,index,**kwargs):
        _bridge.track(self._id,"column",int(index),_json.dumps(kwargs))
    grid_columnconfigure=columnconfigure

class Tk(Widget):
    kind="Tk"
    def __init__(self,*args,**kwargs):
        global _default_root
        self.master=None
        self._id=_id("root")
        self.children={}
        self._config={}
        self._command=None
        _widgets[self._id]=self
        if _default_root is None:
            _default_root=self
        _bridge.create("Tk",self._id,"","{}")
    def title(self,text=None):
        if text is None:
            return str(_bridge.rootTitle(self._id))
        _bridge.rootTitle(self._id,str(text))
    wm_title=title
    def geometry(self,value=None):
        if value is None:
            return str(_bridge.geometry(self._id,""))
        _bridge.geometry(self._id,str(value))
    wm_geometry=geometry
    def resizable(self,width=None,height=None):
        return (True,True)
    def minsize(self,width=None,height=None):
        pass
    def maxsize(self,width=None,height=None):
        pass
    def destroy(self):
        global _default_root
        super().destroy()
        if _default_root is self:
            _default_root=None

class Toplevel(Tk):
    def __init__(self, master=None, **kwargs):
        super().__init__()
        self.configure(**kwargs)

def _root():
    global _default_root
    if _default_root is None:
        _default_root=Tk()
    return _default_root

class Frame(Widget):
    kind="Frame"

class LabelFrame(Frame):
    kind="LabelFrame"

class Label(Widget):
    kind="Label"

class Button(Widget):
    kind="Button"
    def invoke(self):
        if self._config.get("state")!="disabled" and self._command:
            return self._command()

class Entry(Widget):
    kind="Entry"
    def get(self):
        return str(_bridge.get(self._id))
    def insert(self,index,string):
        _bridge.edit(self._id,"insert",str(index),str(string))
    def delete(self,first,last=None):
        _bridge.edit(self._id,"delete",str(first),"" if last is None else str(last))

class Text(Entry):
    kind="Text"
    def get(self, index1="1.0", index2="end"):
        text=str(_bridge.get(self._id))
        return text+"\n" if index2=="end" else text

class Checkbutton(Button):
    kind="Checkbutton"
    def __init__(self,master=None,cnf=None,**kwargs):
        self.variable=kwargs.setdefault("variable",IntVar()) if not cnf else kwargs.get("variable")
        super().__init__(master,cnf,**kwargs)
    def select(self):
        _bridge.setSelection(self._id,True)
    def deselect(self):
        _bridge.setSelection(self._id,False)
    def toggle(self):
        _bridge.setSelection(self._id,not bool(_bridge.selected(self._id)))
    def invoke(self):
        self.toggle()
        return super().invoke()

class Radiobutton(Checkbutton):
    kind="Radiobutton"

class Scale(Widget):
    kind="Scale"
    def get(self):
        value=float(_bridge.get(self._id))
        return int(value) if value.is_integer() else value
    def set(self,value):
        _bridge.set(self._id,str(value))
    def configure(self,cnf=None,**kwargs):
        values=dict(cnf or {});values.update(kwargs)
        callback=values.pop("command",None)
        super().configure(values)
        if callback is not None:
            _bridge.command(self._id,_proxy(lambda:callback(str(self.get())),self))
    config=configure

class Canvas(Widget):
    kind="Canvas"
    def _create(self,kind,args,kwargs):
        if len(args)==1 and isinstance(args[0],(list,tuple)):
            args=args[0]
        return int(_bridge.canvasCreate(self._id,kind,_json.dumps(list(args)),_json.dumps(kwargs)))
    def create_line(self,*args,**kwargs):
        return self._create("line",args,kwargs)
    def create_rectangle(self,*args,**kwargs):
        return self._create("rectangle",args,kwargs)
    def create_oval(self,*args,**kwargs):
        return self._create("oval",args,kwargs)
    def create_polygon(self,*args,**kwargs):
        return self._create("polygon",args,kwargs)
    def create_text(self,*args,**kwargs):
        return self._create("text",args,kwargs)
    def delete(self,*items):
        for item in items:
            _bridge.canvasDelete(self._id,str(item))
    def move(self,item,x,y):
        _bridge.canvasMove(self._id,str(item),float(x),float(y))
    def itemconfigure(self,item,**kwargs):
        _bridge.canvasConfigure(self._id,str(item),_json.dumps(kwargs))
    itemconfig=itemconfigure

def mainloop(n=0):
    pass

def _show(kind,title=None,message=None,**kwargs):
    return str(_bridge.message(kind,str(title or ""),str(message or "")))

messagebox=_types.ModuleType("tkinter.messagebox")
messagebox.showinfo=lambda title=None,message=None,**kwargs:_show("info",title,message)
messagebox.showwarning=lambda title=None,message=None,**kwargs:_show("warning",title,message)
messagebox.showerror=lambda title=None,message=None,**kwargs:_show("error",title,message)
messagebox.askyesno=lambda title=None,message=None,**kwargs:_show("confirm",title,message)=="yes"
_sys.modules["tkinter.messagebox"]=messagebox

ttk=_types.ModuleType("tkinter.ttk")
for _name in ("Frame","LabelFrame","Label","Button","Entry","Checkbutton","Radiobutton","Scale"):
    setattr(ttk,_name,globals()[_name])
_sys.modules["tkinter.ttk"]=ttk
__path__=[]
__all__=[name for name in globals() if not name.startswith("_")]

