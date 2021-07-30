// Module of webpack-embedded svg strings (relies on svgo-loader and raw-loader)


/* WARN Regarding dynamic imports such as with `require()` and `require.context()`

Webpack can import dynamically, but since it (believes) it cannot know the module path until runtime
it instead imports EVERY FILE in the dir so that they'll all be available to choose from.

require(`dir/${name}.svg`) gets turned into require.context('dir', false, /^.*\.svg$/)

And since it does static analysis it cannot import the following:
    path = 'dir/name.js'; require(path)
as it doesn't know what dir it will be in till runtime.

This could be good for importing all files in a dir (if desired), but NOT for some files only.

See https://webpack.js.org/guides/dependency-management

*/


export default {
    // NOTE `require` used only because `export icon from 'icon.svg'` is not possible
    //      Only `export {icon} from 'icon.svg'` is possible (but not suitable)

    // Custom
    logo_app:               require('@/assets/logo_app.svg').default,

    // Material icons
    icon_settings:          require('md-icon-svgs/settings.svg').default,
    icon_arrow_back:        require('md-icon-svgs/arrow_back.svg').default,
    icon_arrow_forward:     require('md-icon-svgs/arrow_forward.svg').default,
    icon_arrow_upward:      require('md-icon-svgs/arrow_upward.svg').default,
    icon_arrow_downward:    require('md-icon-svgs/arrow_downward.svg').default,
    icon_more_vert:         require('md-icon-svgs/more_vert.svg').default,
    icon_chevron_left:      require('md-icon-svgs/chevron_left.svg').default,
    icon_chevron_right:     require('md-icon-svgs/chevron_right.svg').default,
    icon_open_in_new:       require('md-icon-svgs/open_in_new.svg').default,
    icon_view_list:         require('md-icon-svgs/view_list.svg').default,
    icon_subject:           require('md-icon-svgs/subject.svg').default,
    icon_group:             require('md-icon-svgs/group.svg').default,
    icon_attach_money:      require('md-icon-svgs/attach_money.svg').default,
    icon_get_app:           require('md-icon-svgs/get_app.svg').default,
    icon_warning:           require('md-icon-svgs/warning.svg').default,
    icon_info:              require('md-icon-svgs/info.svg').default,
    icon_close:             require('md-icon-svgs/close.svg').default,
    icon_share:             require('md-icon-svgs/share.svg').default,
    icon_hearing:           require('md-icon-svgs/hearing.svg').default,
    icon_record_voice_over: require('md-icon-svgs/record_voice_over.svg').default,
    icon_network_check:     require('md-icon-svgs/network_check.svg').default,
    icon_star:              require('md-icon-svgs/star.svg').default,
    icon_star_border:       require('md-icon-svgs/star_border.svg').default,
    icon_schedule:          require('md-icon-svgs/schedule.svg').default,
    icon_chat:              require('md-icon-svgs/chat.svg').default,
    icon_help:              require('md-icon-svgs/help.svg').default,
    icon_mail:              require('md-icon-svgs/mail.svg').default,
    icon_play_arrow:        require('md-icon-svgs/play_arrow.svg').default,
    icon_pause:             require('md-icon-svgs/pause.svg').default,
    icon_skip_next:         require('md-icon-svgs/skip_next.svg').default,
    icon_error:             require('md-icon-svgs/error.svg').default,
    icon_keyboard_tab:      require('md-icon-svgs/keyboard_tab.svg').default,
    icon_meeting_room:      require('md-icon-svgs/meeting_room.svg').default,
    icon_volume_off:        require('md-icon-svgs/volume_off.svg').default,
    icon_volume_up:         require('md-icon-svgs/volume_up.svg').default,
    icon_volume_down:       require('md-icon-svgs/volume_down.svg').default,
    icon_subscriptions:     require('md-icon-svgs/subscriptions.svg').default,
    icon_send:              require('md-icon-svgs/send.svg').default,
    icon_done:              require('md-icon-svgs/done.svg').default,
    icon_live_tv:           require('md-icon-svgs/live_tv.svg').default,
    icon_fullscreen:        require('md-icon-svgs/fullscreen.svg').default,
}
