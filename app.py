from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit
import random
import string

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app)

rooms = {}  # Stores room info and participants

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/room/<room_code>')
def room(room_code):
    if room_code not in rooms:
        return "Room does not exist", 404
    return render_template('room.html', room_code=room_code)

@socketio.on('create_room')
def handle_create_room():
    room_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))  # Random 6 character code
    rooms[room_code] = []  # Initialize the room with no participants
    print(f"Room created with code: {room_code}")
    emit('room_created', {'room_code': room_code})

@socketio.on('join_room')
def handle_join_room(data):
    room_code = data['room_code']
    if room_code in rooms:
        rooms[room_code].append(request.sid)  # Add the user to the room
        print(f"User {request.sid} joined room {room_code}")

        if len(rooms[room_code]) == 2:  # Only two participants can join a room
            # Start the video call by emitting 'match' to both participants
            peer1, peer2 = rooms[room_code]
            emit('match', {'room_code': room_code, 'peer': peer2}, to=peer1)
            emit('match', {'room_code': room_code, 'peer': peer1}, to=peer2)
    else:
        emit('room_error', {'message': 'Room not found'})

@socketio.on('skip')
def handle_skip(data):
    room_code = data['room_code']
    if room_code in rooms:
        rooms[room_code].pop(0)  # Remove the first user (who wants to skip)
        emit('skip_match', to=request.sid)

@socketio.on('disconnect')
def handle_disconnect():
    for room_code in rooms:
        if request.sid in rooms[room_code]:
            rooms[room_code].remove(request.sid)
            print(f"User {request.sid} disconnected from room {room_code}")
            break

if __name__ == '__main__':
    socketio.run(app, debug=True)
