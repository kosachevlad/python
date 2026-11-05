import os as _kp_os, sys as _kp_sys, io as _kp_io, builtins as _kp_builtins
import contextlib as _kp_contextlib, importlib as _kp_importlib, traceback as _kp_traceback
if '_kp_original_path' not in globals():
    _kp_original_path = list(_kp_sys.path)
    _kp_original_cwd = _kp_os.getcwd()
    _kp_original_argv = list(_kp_sys.argv)
    _kp_original_input = _kp_builtins.input

def _kp_input(prompt=''):
    from js import kodikProjectInput
    value = kodikProjectInput(str(prompt))
    if value is None:
        raise EOFError('Ввід скасовано')
    return str(value)

def _kp_clear_modules(root):
    for name, module in list(_kp_sys.modules.items()):
        filename = getattr(module, '__file__', None)
        if isinstance(filename, str) and _kp_os.path.realpath(filename).startswith(root + '/'):
            _kp_sys.modules.pop(name, None)
    _kp_importlib.invalidate_caches()

def _kp_execute(code, filename, root):
    _kp_clear_modules(root)
    _kp_os.chdir(root)
    _kp_sys.path[:] = [_kp_os.path.dirname(filename), root] + [p for p in _kp_original_path if p not in (root, _kp_os.path.dirname(filename))]
    _kp_sys.argv[:] = [filename]
    _kp_builtins.input = _kp_input
    namespace = {'__name__':'__main__', '__file__':filename, '__package__':None}
    diagnostic = _kp_sys.modules.get('_kodik_diagnostics')
    if diagnostic is not None:
        diagnostic._executed[filename] = code
    output = _kp_io.StringIO()
    with _kp_contextlib.redirect_stdout(output), _kp_contextlib.redirect_stderr(output):
        try:
            exec(compile(code, filename, 'exec'), namespace)
        except SystemExit as error:
            if error.code not in (None, 0):
                print('SystemExit:', error.code)
        except BaseException as error:
            if diagnostic is not None:
                print(diagnostic.report_exception(error))
            else:
                _kp_traceback.print_exc()
    return output.getvalue()

def _kp_leave(root):
    _kp_clear_modules(root)
    _kp_sys.path[:] = _kp_original_path
    _kp_sys.argv[:] = _kp_original_argv
    _kp_builtins.input = _kp_original_input
    _kp_os.chdir(_kp_original_cwd)

