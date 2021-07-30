
from secrets import token_urlsafe
from urllib.parse import quote_plus

import bleach


class HandlersMedia:
    """Handlers for modifying a room's media"""

    def handle_room_media_add(self):
        """Add a new media item to the end of the room's media items list"""

        # Input
        room_id, name, media_type, content = self.expect(
            ['room_id', 'media_name', 'media_type', 'media_content'])
        self.check_permission(room_id, 'dj')

        # Validate the content supplied since `expect` doesn't
        clean_content = {}

        if media_type == 'youtube':
            # Require the video id and ensure no URL injection risks
            youtube_id = self.expect_from(content, {'id': str}, ['id'])
            clean_content['id'] = quote_plus(youtube_id)

        # elif media_type == 'text':
        #     # Sanitize text and/or image URL
        #     # NOTE Neither is required, and can create a blank item if desired
        #     types = {'html': str, 'img': str}
        #     html, img = self.expect_from(content, types, nullable=['html', 'img'])
        #     # Sanitize html
        #     if html:
        #         html = bleach.clean(html, strip=True, tags=('strong', 'em'))
        #     clean_content['html'] = html
        #     # Sanitize image url
        #     # WARN Only allow HTTPS for security (and avoid browser warnings)
        #     if img and not img.startswith('https://'):
        #         self.client_error("Only HTTPS is supported for image URLs")
        #     clean_content['img'] = img

        else:
            self.client_error("Invalid media type: " + media_type)

        # If the first media item, then will also load it ready for play
        set_loaded = '' if self.room['media'] else ', loaded = :loaded, paused = :paused'
        set_loaded_values = {} if self.room['media'] else {':loaded': 0, ':paused': 0}

        # Add the media to end of list
        # WARN Whenever loaded set, also set media, to avoid rare case of index off due to db lag
        self.room = {
            'UpdateExpression': 'SET media=:media' + set_loaded,
            'ExpressionAttributeValues': {
                ':media': [*self.room['media'], {
                    'id': token_urlsafe(6),  # Certain to be unique amongst fellow items
                    'name': name,
                    'type': media_type,
                    'content': clean_content,
                }],
                **set_loaded_values,
            }
        }

        # Update all room's clients
        self.broadcast_room_state()


    def handle_room_media_rearrange(self):
        """Swap the positions of two media items

        NOTE This task is harmless if fails so not reporting back to user if so

        """

        # Input
        room_id, before_id, after_id = self.expect(['room_id', 'media_id', 'media_id_after'])
        if before_id == after_id:
            self.client_error("Cannot rearrange the same item")
        self.check_permission(room_id, 'dj')

        # Ensure both media items exist in the room
        media_ids = tuple(item['id'] for item in self.room['media'])
        try:
            before_index = media_ids.index(before_id)
            after_index = media_ids.index(after_id)
        except ValueError:
            return

        # Ensure order not correct already
        if before_index < after_index:
            return

        # Swap the items
        # NOTE Overwritting values in `self.room` so broadcast will later use correct ones
        before_item = self.room['media'][before_index]
        self.room['media'][before_index] = self.room['media'][after_index]
        self.room['media'][after_index] = before_item

        # Correct loaded if changed
        if self.room['loaded'] in (before_index, after_index):
            self.room['loaded'] = before_index if self.room['loaded'] == after_index else after_index

        # Update the room
        self.room = {
            'UpdateExpression': 'SET media=:media, loaded=:loaded',
            'ExpressionAttributeValues': {
                ':media': self.room['media'],
                ':loaded': self.room['loaded'],
            }
        }

        # Update all room's clients
        self.broadcast_room_state()


    def handle_room_media_play(self):
        """Play the currently loaded media item"""

        # Input
        # NOTE start may be future too, to schedule playing a video ahead of time
        room_id, start = self.expect(['room_id', 'room_start'])
        self.check_permission(room_id, 'dj')

        # Ensure media items exist in the room
        if self.room['loaded'] is None:
            self.client_confused("No media item to play")

        # Play
        self.room = {
            'UpdateExpression': 'SET #_start = :start, paused = :paused',
            'ExpressionAttributeNames': {
                '#_start': 'start',
            },
            'ExpressionAttributeValues': {
                ':start': start,
                ':paused': None,
            }
        }

        # Update all room's clients
        self.broadcast_room_state()


    def handle_room_media_pause(self):
        """Pause the currently loaded media item"""

        # Input
        room_id, paused = self.expect(['room_id', 'room_paused'])
        self.check_permission(room_id, 'dj')
        if paused < 0:
            self.client_error("Value for 'paused' cannot be negative")

        # Ensure media items exist in the room
        if self.room['loaded'] is None:
            self.client_confused("No media item to pause")

        # Pause
        self.room = {
            'UpdateExpression': 'SET #_start = :start, paused = :paused',
            'ExpressionAttributeNames': {
                '#_start': 'start',
            },
            'ExpressionAttributeValues': {
                ':start': None,
                ':paused': paused,
            }
        }

        # Update all room's clients
        self.broadcast_room_state()


    def handle_room_media_load(self):
        """Load a media item for play"""

        # Input
        room_id, media_id = self.expect(['room_id', 'media_id'])
        self.check_permission(room_id, 'dj')

        # Get item's index / ensure it exists
        media_ids = tuple(item['id'] for item in self.room['media'])
        if media_id not in media_ids:
            self.client_confused("Chosen media item does not exist")

        # Change loaded media
        # WARN Whenever loaded set, also set media, to avoid rare case of index off due to db lag
        self.room = {
            'UpdateExpression': 'SET #_start=:start, paused=:paused, loaded=:loaded, media=:media',
            'ExpressionAttributeNames': {
                '#_start': 'start',
            },
            'ExpressionAttributeValues': {
                ':start': None,
                ':paused': 0,
                ':loaded': media_ids.index(media_id),
                ':media': self.room['media'],
            }
        }

        # Update all room's clients
        self.broadcast_room_state()


    def handle_room_media_remove(self):
        """Remove a media item from the room"""

        # Input
        room_id, media_id = self.expect(['room_id', 'media_id'])
        self.check_permission(room_id, 'dj')

        # Get item's index / ensure it exists
        media_ids = tuple(item['id'] for item in self.room['media'])
        if media_id not in media_ids:
            self.client_confused("Playlist item already removed")
        item_index = media_ids.index(media_id)

        # See if need to make additional updates
        extra_updates = ''
        extra_values = {}
        # If was the last item, reset playback properties
        if len(media_ids) == 1:
            extra_updates = ', loaded=:loaded, #_start=:start, paused=:paused'
            extra_values = {
                ':loaded': None,
                ':start': None,
                ':paused': None,
            }
        # If was the loaded item, load instead the next item (or previous if no next)
        # NOTE If loading next then keeping loaded the same will achieve this
        elif item_index == self.room['loaded']:
            last_index_after_rm = len(media_ids) - 2
            extra_updates = ', loaded=:loaded, #_start=:start, paused=:paused'
            extra_values = {
                ':loaded': min(item_index, last_index_after_rm),
                ':start': None,
                ':paused': 0,
            }
        # If removing the item will disalign the loaded index, fix it
        elif item_index < self.room['loaded']:
            extra_updates = ', loaded=:loaded'
            extra_values = {
                ':loaded': self.room['loaded'] - 1,
            }

        # Create copy of media with item removed
        # WARN Set whole media key again rather than use "REMOVE" to avoid wrong index if db lag
        media = self.room['media'].copy()
        del media[item_index]

        # Remove from db
        update_dict = {
            # WARN Keep space at end in case extra_updates
            # NOTE New actions merely separated by a space (e.g. "SET a=a, b=b REMOVE c[0]")
            'UpdateExpression': 'SET media=:media' + extra_updates,
            'ExpressionAttributeValues': {
                ':media': media,
                **extra_values,
            },
        }
        # NOTE This key cannot exist if empty
        if '#_start' in extra_updates:
            update_dict['ExpressionAttributeNames'] = {'#_start': 'start'}
        self.room = update_dict

        # Update all room's clients
        self.broadcast_room_state()
