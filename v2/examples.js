/* Real outputs, extracted from passing e2e test logs (see VOCABULARY.md "Examples").
   Hand-copied for now from tests/fts/menu/test_01_h1_menu.test of 2026-10-11; the frad extractor will emit this file. */
window.FRAD_EXAMPLES = {

'fts-menu-unconfigured': { source: 'tests/fts/menu/test_01_h1_menu', date: '2026-10-11', lines: [
'[ FRAD first-time setup ]',
'Cluster: new -- this node bootstraps it (VIP 10.254.254.1)',
'1: License terms (view only; a accepts them)',
'2: Host name: unconfigured-10-254-254-2',
'3: Password: factory default (may stay; change it later)',
'4: Time (zone, date, time): America/New_York, 2026-10-11 23:03:16',
'5: NTP: pool.ntp.org',
'6: DNS: none',
'7: Cluster name: frad-10.254.254.1 (default)',
'8: rpool, the system (boot) pool: /dev/sda /dev/sdb (a mirror, 2 copies)',
'9: Management networking (in effect at once)',
'     Management: IF.1 -- 10.254.254.2/255.255.255.0 via 10.254.254.254',
'     Virtual IP: 10.254.254.1',
'     Storage network: IF.3 (eth2) -- 10.254.253.2/255.255.255.0',
'------------------------------------------------------------------------------------------------------------------------',
'     Dev    Label        DevID/Cfg   BusID/Slaves               HWAddr     Driver  Link  State Speed(actual/advertised)',
'------------------------------------------------------------------------------------------------------------------------',
'    eth0     IF.1        8086.10d3   0000:00:04.0    02:8d:6a:e2:dc:9f     e1000e   yes     UP        1000F/1000F',
'    eth1     IF.2        8086.10d3   0000:00:05.0    02:a1:14:91:e4:83     e1000e   yes     UP        1000F/1000F',
'    eth2     IF.3        8086.10d3   0000:00:06.0    02:9d:6c:2a:9a:4c     e1000e   yes     UP        1000F/1000F',
'------------------------------------------------------------------------------------------------------------------------',
'a: Accept the license terms and apply the above configuration',
'x: Leave to the CLI (this screen comes back at the next login)',
'Select option: 2'
] },

'fts-menu-hostname': { source: 'tests/fts/menu/test_01_h1_menu', date: '2026-10-11', lines: [
'- Change the Host Name -',
'Enter the new host name: h1'
] },

'fts-menu': { source: 'tests/fts/menu/test_01_h1_menu', date: '2026-10-11', lines: [
'[ FRAD first-time setup ]',
'Cluster: new -- this node bootstraps it (VIP 10.254.254.1)',
'1: License terms (view only; a accepts them)',
'2: Host name: h1',
'3: Password: factory default (may stay; change it later)',
'4: Time (zone, date, time): America/New_York, 2026-10-11 23:03:16',
'5: NTP: pool.ntp.org',
'6: DNS: none',
'7: Cluster name: frad-10.254.254.1 (default)',
'8: rpool, the system (boot) pool: /dev/sda /dev/sdb (a mirror, 2 copies)',
'9: Management networking (in effect at once)',
'     Management: IF.1 -- 10.254.254.2/255.255.255.0 via 10.254.254.254',
'     Virtual IP: 10.254.254.1',
'     Storage network: IF.3 (eth2) -- 10.254.253.2/255.255.255.0',
'------------------------------------------------------------------------------------------------------------------------',
'     Dev    Label        DevID/Cfg   BusID/Slaves               HWAddr     Driver  Link  State Speed(actual/advertised)',
'------------------------------------------------------------------------------------------------------------------------',
'    eth0     IF.1        8086.10d3   0000:00:04.0    02:8d:6a:e2:dc:9f     e1000e   yes     UP        1000F/1000F',
'    eth1     IF.2        8086.10d3   0000:00:05.0    02:a1:14:91:e4:83     e1000e   yes     UP        1000F/1000F',
'    eth2     IF.3        8086.10d3   0000:00:06.0    02:9d:6c:2a:9a:4c     e1000e   yes     UP        1000F/1000F',
'------------------------------------------------------------------------------------------------------------------------',
'a: Accept the license terms and apply the above configuration',
'x: Leave to the CLI (this screen comes back at the next login)',
'Select option: a'
] },

'cli-login': { source: 'tests/e2e/1h/test_02_h1_reboot', date: '2026-10-09', lines: [
'h1 at 10.254.254.12, VIP 10.254.254.11 -- change with: node set',
'hostname|network, cluster set vip',
'Willkommen zu Ah-Pangs fünftem Rad (OS)!',
'License files are not installed',
'Enter "help" for a list of available commands',
'h1> '
] },

'cli-reboot': { source: 'tests/e2e/1h/test_02_h1_reboot', date: '2026-10-09', lines: [
'h1> reboot',
"Enter 'YES' to confirm: YES",
'umount: /mnt/cephfs: not mounted.',
'System is rebooting in 0 minutes',
'h1> ',
'Session terminated, killing shell...[   60.728578] reboot: Restarting system'
] },

'cli-exit': { source: 'tests/fts/menu/test_01_h1_menu', date: '2026-10-11', lines: [
'Willkommen zu Ah-Pangs fünftem Rad (OS)!',
'License files are not installed',
'Enter "help" for a list of available commands',
'h1> exit'
] }

};
