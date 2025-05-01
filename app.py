from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit
import random

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app)

# A dictionary to store users in rooms
rooms = {}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/room/<room_code>')
def room(room_code):
    return render_template('room.html', room_code=room_code)

@socketio.on('create_room')
def handle_create_room():
    room_code = str(random.randint(1000, 9999))  # Create a random room code
    rooms[room_code] = []  # Create a new room
    emit('room_created', {'room_code': room_code}, broadcast=False)

@socketio.on('join_room')
def handle_join_room(data):
    room_code = data['room_code']
    if room_code in rooms:
        if len(rooms[room_code]) == 0:
            # First person joins the room
            rooms[room_code].append(request.sid)
            emit('waiting_for_partner', {'room_code': room_code}, to=request.sid)
        elif len(rooms[room_code]) == 1:
            # Second person joins, establish connection
            partner = rooms[room_code][0]
            rooms[room_code].append(request.sid)
            emit('match', {'room_code': room_code, 'peer': partner}, to=request.sid)
            emit('match', {'room_code': room_code, 'peer': request.sid}, to=partner)
        else:
            emit('room_full', {'message': 'Room is full'}, to=request.sid)
    else:
        emit('room_not_found', {'message': 'Room not found'}, to=request.sid)

@socketio.on('skip')
def handle_skip(data):
    room_code = data['room_code']
    if room_code in rooms:
        # Remove the current user from the room
        rooms[room_code].remove(request.sid)
        if len(rooms[room_code]) == 1:
            partner = rooms[room_code][0]
            emit('match', {'room_code': room_code, 'peer': partner}, to=partner)
        else:
            del rooms[room_code]
    emit('skip_match', to=request.sid)

@socketio.on('ice-candidate')
def handle_ice_candidate(data):
    emit('ice-candidate', data, room=data['to'])

@socketio.on('offer')
def handle_offer(data):
    emit('offer', data, room=data['to'])

@socketio.on('answer')
def handle_answer(data):
    emit('answer', data, room=data['to'])

@socketio.on('disconnect')
def handle_disconnect():
    # Remove the user from the room if they disconnect
    for room_code, users in rooms.items():
        if request.sid in users:
            users.remove(request.sid)
            if len(users) == 0:
                del rooms[room_code]  # Delete the room if no users are left
            break

if __name__ == '__main__':
    socketio.run(app, debug=True)
