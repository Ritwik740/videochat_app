from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit
import random

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app)

waiting_users = []

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('join')
def handle_join():
    if waiting_users:
        partner = waiting_users.pop(0)
        room = f"{request.sid}_{partner}"
        emit('match', {'room': room, 'peer': partner}, to=request.sid)
        emit('match', {'room': room, 'peer': request.sid}, to=partner)
    else:
        waiting_users.append(request.sid)

@socketio.on('skip')
def handle_skip():
    handle_join()

@socketio.on('disconnect')
def handle_disconnect():
    if request.sid in waiting_users:
        waiting_users.remove(request.sid)

if __name__ == '__main__':
    socketio.run(app,host='0.0.0.0', port=5000, debug=True)