// Console logger styled as a netrunner terminal feed.
const ESC = '\x1b[';
const paint = (code) => (text) => `${ESC}${code}m${text}${ESC}0m`;

const green = paint('92');
const cyan = paint('96');
const yellow = paint('93');
const red = paint('91');
const dim = paint('2');

function stamp() {
    return dim(`[${new Date().toLocaleString('sv-SE')}]`);
}

function write(stream, tag, message, extra) {
    const line = `${stamp()} ${tag} ${message}`;
    if (extra !== undefined) stream(line, extra);
    else stream(line);
}

const logger = {
    info: (msg, extra) => write(console.log, cyan('[ SYS_INFO ]'), msg, extra),
    success: (msg, extra) => write(console.log, green('[ SYS_OK   ]'), msg, extra),
    warn: (msg, extra) => write(console.warn, yellow('[ SYS_WARN ]'), msg, extra),
    error: (msg, extra) => write(console.error, red('[ SYS_FAIL ]'), msg, extra),
    debug: (msg, extra) => {
        if (process.env.DEBUG === 'true') write(console.log, dim('[ SYS_DBG  ]'), msg, extra);
    },
    banner() {
        console.log(
            green(
                [
                    '',
                    '  ███╗   ███╗██╗   ██╗███████╗██╗ ██████╗     ██╗██╗  ██╗',
                    '  ████╗ ████║██║   ██║██╔════╝██║██╔════╝     ██║╚██╗██╔╝',
                    '  ██╔████╔██║██║   ██║███████╗██║██║          ██║ ╚███╔╝ ',
                    '  ██║╚██╔╝██║██║   ██║╚════██║██║██║     ██   ██║ ██╔██╗ ',
                    '  ██║ ╚═╝ ██║╚██████╔╝███████║██║╚██████╗╚█████╔╝██╔╝ ██╗',
                    '  ╚═╝     ╚═╝ ╚═════╝ ╚══════╝╚═╝ ╚═════╝ ╚════╝ ╚═╝  ╚═╝',
                ].join('\n'),
            ),
        );
        console.log(cyan('  >> MusicJX v1.0 :: NETRUNNER AUDIO DAEMON :: Authorized Auth: JaniyaX\n'));
    },
};

module.exports = logger;
