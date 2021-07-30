
<template lang='pug'>

div
    v-toolbar.header(v-if='!room || !single_col' color='primary' light dense)
        v-btn(@click='leave' icon)
            app-svg(name='icon_arrow_back')
        v-toolbar-title {{ room_name }}

    div(v-if='!room' class='loading-room')
        app-svg(name='icon_meeting_room' class='opacity-disabled')

        template(v-if='room_invalid')
            p Room does not exist
            v-btn(@click='create_room') Create new room
        template(v-else)
            p(class='opacity-disabled') Entering room...
            v-progress-linear(indeterminate)

    div.content(v-else)

        route-room-copy-dialog

        div.left

            component#media(:is='loaded_component' :content='loaded_content' :style='media_styles'
                :class='{fullscreen: video_only}' @status='media_status = $event')

            route-room-controls(:status='media_status')

            route-room-own-name(v-if='single_col')

            v-tabs(v-model='tab' grow)
                div(v-if='single_col' class='v-tab' @click='leave')
                    app-svg(name='icon_arrow_back')
                v-tab(v-if='single_col')
                    v-badge(:content='status_num_chat' :class='{empty: !status_num_chat}'
                            color='accent')
                        app-svg(name='icon_chat')
                v-tab
                    //- NOTE default badge color is primary, so remove and set using css
                    v-badge(:content='status_num_clients' color='')
                        app-svg(v-if='single_col' name='icon_group')
                        span(v-else) Guests
                v-tab
                    v-badge(:content='status_num_media' color='')
                        app-svg(v-if='single_col' name='icon_subscriptions')
                        span(v-else) Playlist
                v-tab(v-if='admin')
                    app-svg(v-if='single_col' name='icon_settings')
                    span(v-else) Settings
                v-tab
                    app-svg(v-if='single_col' name='icon_help')
                    span(v-else) How To Use
            v-tabs-items(v-model='tab' :touchless='inobounce')
                v-tab-item(v-if='single_col')
                    route-room-chat
                v-tab-item
                    route-room-clients
                v-tab-item
                    route-room-media
                v-tab-item(v-if='admin')
                    route-room-settings
                v-tab-item
                    route-room-help

        div.right(v-if='!single_col')
            v-toolbar(dense)
                v-badge(:content='status_num_chat' :class='{empty: !status_num_chat}' color='accent')
                    span.chat-label Room Chat
            route-room-own-name
            //- TODO Work out how to report unread messages if panel always visible
            route-room-chat(class='chat')


</template>


<script lang='ts'>

import {Component, Vue, Prop, Watch} from 'vue-property-decorator'

import {install_env} from '@/services/utils'
import RouteRoomControls from './assets/RouteRoomControls.vue'
import RouteRoomOwnName from './assets/RouteRoomOwnName.vue'
import RouteRoomCopyDialog from './assets/RouteRoomCopyDialog.vue'
import RouteRoomChat from './assets/RouteRoomChat.vue'
import RouteRoomClients from './assets/RouteRoomClients.vue'
import RouteRoomMedia from './assets/RouteRoomMedia.vue'
import RouteRoomSettings from './assets/RouteRoomSettings.vue'
import RouteRoomHelp from './assets/RouteRoomHelp.vue'
import MediaNone from './assets/MediaNone.vue'
import MediaYoutube from './assets/MediaYoutube.vue'


@Component({
    components: {
        RouteRoomControls, RouteRoomOwnName, RouteRoomCopyDialog,
        RouteRoomChat, RouteRoomClients, RouteRoomMedia, RouteRoomSettings, RouteRoomHelp,
        MediaNone, MediaYoutube,
    },
})
export default class extends Vue {

    tab = 0
    media_status = null  // Media component uses to communicate status to controls component

    @Prop() room_id

    get room(){
        return this.$store.state.tmp.room
    }

    get room_invalid(){
        return this.$store.state.tmp.invalid_rooms.includes(this.room_id)
    }

    get room_name(){
        // Get room name from state if loaded, otherwise fall back on known_rooms
        if (this.room){
            return this.room.name
        }
        return this.$store.state.known_rooms[this.room_id]?.name || "Room"
    }

    get admin(){
        return this.$store.state.tmp.room_admin
    }

    get single_col(){
        /* Return whether to use a single column or two column layout

        Single column always used for narrow viewports (i.e phones)
        Two column works best for wider viewports
            Most computers have viewports with similar aspect ratio to videos (16:9)
            So must reduce video width to fit in any other content
            When width reduced, leaves space both below and to side of video
            So two column layout maximises the use of the available space

        Virtual keyboard
            On iOS the viewport will stay the same and get shifted up off screen (works well)
            On Android viewport will change size and squish layout
            So best to hide video when entering text into something

        */
        const viewport_width = this.$store.state.tmp.viewport_width
        const viewport_height = this.$store.state.tmp.viewport_height
        return viewport_width < 1100
    }

    get video_only(){
        // Whether to show only the video, for when phones in landscape
        const viewport_width = this.$store.state.tmp.viewport_width
        const viewport_height = this.$store.state.tmp.viewport_height
        // Don't trigger if phone keyboard has triggered a landscape viewport (would hide field)
        const focused_name = self.document.activeElement.nodeName
        const focused_input = ['TEXTAREA', 'INPUT'].includes(focused_name)
        return viewport_width > viewport_height && viewport_height < 500 && !focused_input
    }

    get status_num_chat(){
        // Number of unread messages
        return this.$store.state.tmp.room_messages_unread
    }

    get status_num_clients(){
        // Number of clients in room
        return this.$store.state.tmp.room_clients.total
    }

    get status_num_media(){
        // Number of media items
        // NOTE Should always be visible, even if 0, so make string else v-badge will hide
        return '' + this.room.media.length
    }

    get loaded_component(){
        // Return name of media component to use based on the media type
        const type = this.room.media[this.room.loaded]?.type || 'None'
        return `Media${type[0].toUpperCase()}${type.slice(1)}`
    }

    get loaded_content(){
        // Return the media content to pass to the media component
        // NOTE Room may be null if watch_loaded_content triggers this
        return this.room ? this.room.media[this.room.loaded]?.content : null
    }

    get media_styles(){
        // Return styles for media component's width/height based on viewport
        // NOTE Was impossible to achieve this level of complexity in CSS alone

        // Get viewport dimensions
        const viewport_width = this.$store.state.tmp.viewport_width
        const viewport_height = this.$store.state.tmp.viewport_height

        // Determine height if use full width
        let width = viewport_width
        let height = width / 16 * 9

        // Don't allow height to take up too much of screen though
        const max_height = viewport_height * 0.35
        if (height > max_height){
            height = max_height
            width = height / 9 * 16
        }

        // Set the new values
        // WARN Must use min-... to prevent tabs getting priority in their own growth
        return {
            'min-width': width + 'px',
            'min-height': height + 'px',
        }
    }

    get inobounce(){
        // Boolean for whether inobounce is enabled (by default on ios) to stop bouncing page
        // NOTE If inobounce AND tabs swipe are both enabled then can't scroll tab contents
        return self._inobounce
    }

    @Watch('tab') watch_tab(){
        // Scroll to bottom of chat whenever open it
        if (this.single_col && this.tab === 0){
            // NOTE Must wait for chat to appear (but nextTick didn't work)
            setTimeout(() => {
                const msgs = self.document.querySelector('.chat-messages')
                if (!msgs){
                    return
                }
                msgs.scrollTo(0, msgs.scrollHeight)
                // If unread isn't zero, reset it, as new messages now visible
                if (this.$store.state.tmp.room_messages_unread !== 0){
                    this.$store.commit('tmp_set', ['room_messages_unread', 0])
                }
            }, 1)
        }
    }

    @Watch('$store.state.tmp.room_messages_unread') watch_unread(){
        // If new messages are already visible then reset unread count
        if (this.$store.state.tmp.room_messages_unread === 0){
            return  // Already zero
        }
        if (this.single_col && this.tab !== 0){
            return  // Chat not open
        }
        // Check after delay to allow auto-scrolling to happen if near bottom
        setTimeout(() => {
            // Get messages container
            const msgs = self.document.querySelector('.chat-messages')
            if (!msgs){
                return
            }
            // Work out how far off expected scroll position and reset if seem to be near bottom
            // NOTE scrollTop's max is scrollHeight - clientHeight
            const diff = msgs.scrollHeight - msgs.clientHeight - msgs.scrollTop
            if (Math.abs(diff) < 50){
                this.$store.commit('tmp_set', ['room_messages_unread', 0])
            }
        }, 10)  // Auto-scroll happens after $nextTick
    }

    @Watch('loaded_content') watch_loaded_content(){
        // Reset media_status whenever media changes
        // NOTE Watching `loaded` wouldn't work as could be unchanged even if media added/removed
        this.media_status = null
    }

    leave(){
        // Leave the room
        if (this.room_invalid){
            this.$router.push('/')
        } else{
            // NOTE By changing the room state the app will auto kick out of room
            this.$store.dispatch('client_leave')
        }
    }

    create_room(){
        this.$store.dispatch('room_create')
    }

    beforeRouteEnter(to, from, next){
        next(self => {
            // Send a join room request if state says not currently in the room
            if (self.room_id !== self.$store.state.tmp.room?.id){
                self.$store.dispatch('client_join', self.room_id)
            }
        })
    }

}

</script>


<style lang='sass' scoped>


$room-content-width: 1500px  // Any wider makes content harder to read (and height restricts too)


.header ::v-deep .v-toolbar__content
    // Rooms have wider width than usual
    max-width: $room-content-width !important


.loading-room
    // Center and size the loading room progress message
    margin-left: auto
    margin-right: auto
    margin-top: 10vh  // Position near top but lower the taller the screen is
    max-width: 200px
    text-align: center

    svg
        width: 80px
        height: 80px


.content
    flex-grow: 1
    width: 100%  // Take up as much width as allowed (flex-grow:1 didn't achieve this when centered)
    max-width: $room-content-width
    align-self: center  // Center if reached max width
    overflow: hidden  // A trigger to prevent this growing off viewport
    display: flex
    justify-content: center

    .left
        flex-basis: 0  // Grow as if started from 0
        flex-grow: 2
        display: flex
        flex-direction: column
        max-width: $header-width
        overflow: hidden  // Forces long playlist item names to clip rather than leave viewport

    .right
        flex-basis: 0  // Grow as if started from 0
        flex-grow: 1
        display: flex
        flex-direction: column
        border-left-width: 4px
        border-left-style: solid
        // Give border some color as toolbars (for dark, white bars are already white)
        @include themed(border-left-color, rgba(#000, 0.12), #272727)
        z-index: 1  // Prevent adjacent toolbars casting shadow over sidebar

        ::v-deep .v-toolbar__content
            justify-content: center

        .chat-label
            // Copy styling of tabs to blend in
            font-weight: 500
            text-transform: uppercase
            font-size: 0.875rem
            opacity: 0.6
            padding: 0 6px

        .chat
            flex-grow: 1
            display: flex
            flex-direction: column
            overflow: hidden  // A trigger to prevent this growing off viewport


#media
    // Center (if not full viewport width)
    margin: 0 auto
    // Allow centering contents (needed for paused/etc icons)
    display: flex

    &.fullscreen
        position: fixed
        top: 0
        bottom: 0
        left: 0
        right: 0
        z-index: 100


::v-deep

    // Make tab contents take up whole page (leave scrollable portions to each individual tab item)
    // NOTE Must apply to all elements from base .v-tabs-items to the RouteRoomXxx item (> *)
    .v-tabs-items, .v-window__container, .v-window-item, .v-window-item > *
        flex-grow: 1
        display: flex
        flex-direction: column
        // NOTE Important to set min-height to stop long content pushing app off viewport
        //      Flexbox seems to auto-set min-height to the original contents or something?!
        min-height: 0

    .v-tabs
        // For some reason using 'grow' makes both tab buttons AND their container .v-tabs grow
        flex-grow: 0
        // Provide same shadow as toolbar (important for light theme)
        box-shadow: 0px 2px 4px -1px rgba(0, 0, 0, 0.2), 0px 4px 5px 0px rgba(0, 0, 0, 0.14), 0px 1px 10px 0px rgba(0, 0, 0, 0.12)

    // Allow all tabs to be shown at same time
    .v-tab
        min-width: 40px  // Default 90px
        padding: 0 8px  // Default 16px

    // If badge is empty don't show its background (can't hide as wraps button)
    .v-badge.empty .v-badge__badge
        background-color: transparent !important

    // Lower tab badges a little so not cut off by tab item contents
    .v-badge__wrapper
        top: 10px
        left: 5px

        // Bring closer to icon if small screen (so that still fits even if two digits)
        @media (max-width: 470px)
            top: 8px
            left: -7px

        // Make default color of badges subtle
        .v-badge__badge
            @include themed(background-color, #ccc, #444)


    // For some reason prev/next horizontal scroll arrows are shown even when not needed
    .v-slide-group__prev, .v-slide-group__next
        display: none !important


</style>
