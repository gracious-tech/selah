
import os
from datetime import datetime

import boto3
from boto3.dynamodb.conditions import Attr


class HandlersClient:
    """Handlers for modifying a client record"""


    def client_join_room(self, room_id, is_admin, client_name):
        """Helper for making a client join a room

        Also sets client's name since can't set within handle_aws_connect, and repeat sets harmless

        """
        self.client = {
            'UpdateExpression': (
                'SET #_name=:name, room_id=:id, room_joined=:joined, room_admin=:admin, room_synced=:synced'),
            'ExpressionAttributeNames': {
                '#_name': 'name',  # name is a reserved word
            },
            'ExpressionAttributeValues': {
                ':name': client_name,
                ':id': room_id,
                ':joined': datetime.now().timestamp(),
                ':admin': is_admin,
                ':synced': None,
            },
        }


    def kwargs_client_leave(self, socket):
        """Helper for generating kwargs for making a client leave a room"""
        return {
            'Key': {'socket': socket},
            'ConditionExpression': Attr('socket').exists(),  # WARN Important (see handlers.py)
            'UpdateExpression': (
                'SET room_id=:id, room_joined=:joined, room_admin=:admin, room_synced=:synced'),
            'ExpressionAttributeValues': {
                # NOTE See `handle_aws_connect` for notes on default values
                ':id': '#',
                ':joined': 0,
                ':admin': None,
                ':synced': None,
            },
        }


    def handle_client_join(self):
        """Join a room"""
        room_id, secret, client_name = self.expect(['room_id'], ['room_secret', 'client_name'])

        # First ensure the room exists
        resp = self.db_rooms.get_item(Key={'id': room_id})
        room = resp.get('Item')
        if not room:
            # Tell client the id is invalid so it can give up attempt and return to root route
            self.reply('room_invalid', {'room_id': room_id})
            return

        # Add the room to cache so `room_state` can reuse it
        # NOTE Usually cached room will be the one the client is in, but soon will be!
        self._cached_room = {
            'id': room_id,
            'value': room,
        }

        # Tell client if secret no longer valid (can still join room though)
        is_admin = secret == room['secret']
        if secret and not is_admin:
            self.reply('secret_invalid', {'room_id': room_id})

        # Update the client's record
        self.client_join_room(room_id, is_admin, client_name)

        # Send back room's state
        admin_clients, guest_clients, sockets = self.room_clients()
        self.reply('room_joined', {
            'room': self.room_state(),
            'clients': admin_clients if is_admin else guest_clients,
            'admin': is_admin,
            'you': self.sender,
        })

        # Let other clients know this client has joined their room
        self.broadcast_room_clients()


    def handle_client_leave(self):
        """Respond to a client's request to leave a room"""

        # Require the room id so that don't leave a new room if messages out of order
        room_id = self.expect(['room_id'])
        self.check_permission(room_id)  # Will exit if room_id mismatch

        # Let other clients know this client is leaving their room
        # WARN Can't do after actually leaving the room so do briefly before
        self.broadcast_room_clients(exclude_self=True)

        # Wipe room data on client's record
        # NOTE Don't reply to this client as client doesn't need response and will leave manually
        self.client = self.kwargs_client_leave(self.sender)


    def handle_client_name(self):
        """Set the name of the sender"""

        # Input
        name = self.expect(nullable=['client_name'])

        # Update client record
        self.client = {
            'UpdateExpression': 'SET #_name=:name',
            'ExpressionAttributeNames': {
                '#_name': 'name',
            },
            'ExpressionAttributeValues': {
                ':name': name,
            },
        }

        # Tell other clients about this client's new name
        self.broadcast_room_clients()


    def handle_client_synced(self):
        """Set the synced status of the sender"""

        # Input
        # NOTE None if not synced, otherwise the number of ms off from target
        synced = self.expect(nullable=['client_synced'])

        # Update client record
        self.client = {
            'UpdateExpression': 'SET room_synced=:synced',
            'ExpressionAttributeValues': {
                ':synced': synced,
            },
        }

        # Tell other clients about this client's new sync status
        self.broadcast_room_clients()


    def handle_client_feedback(self):
        """Pass on feedback from a user to the contact SNS topic"""

        # Input
        feedback, user_agent, email = self.expect(['client_feedback', 'client_user_agent'],
            nullable=['client_email'])

        # Prepare message
        message = f"\nEmail: {email}\n\nUA: {user_agent}\n\n{feedback}"

        # Publish to topic
        boto3.client('sns').publish(
            TopicArn=os.environ['TOPIC_CONTACT'],
            Subject="Selah Feedback: " + feedback[:50].replace('\n', ' ') + "...",
            Message=message,
        )


    def handle_client_time(self):
        pass  # Deprecated
