from flask import Flask
from flaskwebgui import FlaskUI
from waitress import serve


def create_app():
    app = Flask(__name__)

    from .main import main as main_blueprint
    app.register_blueprint(main_blueprint)

    def start_server():
        serve(app, host="127.0.0.1", port=5000)

    ui = FlaskUI(app, maximized=True, server=start_server, host="127.0.0.1", port=5000)

    return ui
