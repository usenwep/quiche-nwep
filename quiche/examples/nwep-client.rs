// Copyright (C) 2019, Cloudflare, Inc.
// Copyright (C) 2025, Ethan Pelletier (NWEP modifications)
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are
// met:
//
//     * Redistributions of source code must retain the above copyright notice,
//       this list of conditions and the following disclaimer.
//
//     * Redistributions in binary form must reproduce the above copyright
//       notice, this list of conditions and the following disclaimer in the
//       documentation and/or other materials provided with the distribution.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS
// IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
// THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
// PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR
// CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
// EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
// PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
// PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
// LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
// NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
// SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

//! NWEP (New Web Exchange Protocol) client example.
//!
//! This is a simple NWEP client that demonstrates:
//! - NWEP protocol negotiation (ALPN: nwep/1)
//! - NWEP methods (READ instead of GET)
//! - Text status tokens (ok, not_found, etc.)
//!
//! Based on the quiche client example.

#[macro_use]
extern crate log;

use quiche::h3::NameValue;

use ring::rand::*;

use std::net::ToSocketAddrs;

const MAX_DATAGRAM_SIZE: usize = 1350;

fn main() {
    let mut buf = [0; 65535];
    let mut out = [0; MAX_DATAGRAM_SIZE];

    let mut args = std::env::args();

    let cmd = &args.next().unwrap();

    if args.len() != 1 {
        println!("Usage: {cmd} URL");
        println!("\nSee tools/apps/ for more complete implementations.");
        return;
    }

    // Parse URL - NWEP uses web:// scheme only (no HTTPS!)
    let url_str = args.next().unwrap();

    // Silently reject non-web:// schemes
    if !url_str.starts_with("web://") {
        std::process::exit(1);
    }

    // Manual parsing since url crate doesn't recognize web://
    // Format: web://host[:port]/path
    let without_scheme = &url_str[6..]; // Remove "web://"

    let (authority, path) = if let Some(slash_pos) = without_scheme.find('/') {
        (&without_scheme[..slash_pos], &without_scheme[slash_pos..])
    } else {
        (without_scheme, "/")
    };

    let (host, port) = if let Some(colon_pos) = authority.rfind(':') {
        // Check if this is IPv6 [::1]:port format
        if authority.starts_with('[') {
            if let Some(bracket_end) = authority.find(']') {
                if bracket_end < colon_pos {
                    // IPv6 with port: [::1]:4433
                    (&authority[..=bracket_end], authority[colon_pos+1..].parse::<u16>().unwrap_or(4433))
                } else {
                    // IPv6 without port: [::1]
                    (authority, 4433)
                }
            } else {
                (authority, 4433)
            }
        } else {
            // Regular host:port
            (&authority[..colon_pos], authority[colon_pos+1..].parse::<u16>().unwrap_or(4433))
        }
    } else {
        (authority, 4433)
    };

    let host_str = host.trim_start_matches('[').trim_end_matches(']');

    // Setup the event loop.
    let mut poll = mio::Poll::new().unwrap();
    let mut events = mio::Events::with_capacity(1024);

    // Resolve server address from our parsed web:// URL
    let peer_addr = format!("{}:{}", host_str, port)
        .parse::<std::net::SocketAddr>()
        .or_else(|_| {
            // Try DNS resolution
            let addrs: Vec<std::net::SocketAddr> =
                (host_str, port).to_socket_addrs()?.collect();
            addrs.into_iter().next().ok_or(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "Could not resolve host"
            ))
        })
        .unwrap_or_else(|_| {
            std::process::exit(1);
        });

    // Bind to INADDR_ANY or IN6ADDR_ANY depending on the IP family of the
    // server address. This is needed on macOS and BSD variants that don't
    // support binding to IN6ADDR_ANY for both v4 and v6.
    let bind_addr = match peer_addr {
        std::net::SocketAddr::V4(_) => "0.0.0.0:0",
        std::net::SocketAddr::V6(_) => "[::]:0",
    };

    // Create the UDP socket backing the QUIC connection, and register it with
    // the event loop.
    let mut socket =
        mio::net::UdpSocket::bind(bind_addr.parse().unwrap()).unwrap();
    poll.registry()
        .register(&mut socket, mio::Token(0), mio::Interest::READABLE)
        .unwrap();

    // Create the configuration for the QUIC connection.
    let mut config = quiche::Config::new(quiche::PROTOCOL_VERSION).unwrap();

    // *CAUTION*: this should not be set to `false` in production!!!
    config.verify_peer(false);

    // Use NWEP protocol
    config
        .set_application_protos(quiche::h3::NWEP_APPLICATION_PROTOCOL)
        .unwrap();

    config.set_max_idle_timeout(5000);
    config.set_max_recv_udp_payload_size(MAX_DATAGRAM_SIZE);
    config.set_max_send_udp_payload_size(MAX_DATAGRAM_SIZE);
    config.set_initial_max_data(10_000_000);
    config.set_initial_max_stream_data_bidi_local(1_000_000);
    config.set_initial_max_stream_data_bidi_remote(1_000_000);
    config.set_initial_max_stream_data_uni(1_000_000);
    config.set_initial_max_streams_bidi(100);
    config.set_initial_max_streams_uni(100);
    config.set_disable_active_migration(true);

    let mut nwep_conn = None;

    // Generate a random source connection ID for the connection.
    let mut scid = [0; quiche::MAX_CONN_ID_LEN];
    SystemRandom::new().fill(&mut scid[..]).unwrap();

    let scid = quiche::ConnectionId::from_ref(&scid);

    // Get local address.
    let local_addr = socket.local_addr().unwrap();

    // Create a QUIC connection and initiate handshake.
    // Use host for SNI (Server Name Indication)
    let mut conn =
        quiche::connect(Some(host_str), &scid, local_addr, peer_addr, &mut config)
            .unwrap();

    info!(
        "connecting to {:} from {:} with scid {}",
        peer_addr,
        socket.local_addr().unwrap(),
        hex_dump(&scid)
    );

    let (write, send_info) = conn.send(&mut out).expect("initial send failed");

    while let Err(e) = socket.send_to(&out[..write], send_info.to) {
        if e.kind() == std::io::ErrorKind::WouldBlock {
            debug!("send() would block");
            continue;
        }

        panic!("send() failed: {e:?}");
    }

    debug!("written {write}");

    let nwep_config = quiche::h3::Config::new().unwrap();

    // NWEP request using READ method and web:// scheme
    // No url crate - we parsed it manually above!
    let req = vec![
        quiche::h3::Header::new(b":method", b"READ"),
        quiche::h3::Header::new(b":scheme", b"web"),
        quiche::h3::Header::new(b":authority", authority.as_bytes()),
        quiche::h3::Header::new(b":path", path.as_bytes()),
        quiche::h3::Header::new(b"user-agent", b"nwep-client"),
    ];

    let req_start = std::time::Instant::now();

    let mut req_sent = false;

    loop {
        poll.poll(&mut events, conn.timeout()).unwrap();

        // Read incoming UDP packets from the socket and feed them to quiche,
        // until there are no more packets to read.
        'read: loop {
            // If the event loop reported no events, it means that the timeout
            // has expired, so handle it without attempting to read packets. We
            // will then proceed with the send loop.
            if events.is_empty() {
                debug!("timed out");

                conn.on_timeout();

                break 'read;
            }

            let (len, from) = match socket.recv_from(&mut buf) {
                Ok(v) => v,

                Err(e) => {
                    // There are no more UDP packets to read, so end the read
                    // loop.
                    if e.kind() == std::io::ErrorKind::WouldBlock {
                        debug!("recv() would block");
                        break 'read;
                    }

                    panic!("recv() failed: {e:?}");
                },
            };

            debug!("got {len} bytes");

            let recv_info = quiche::RecvInfo {
                to: local_addr,
                from,
            };

            // Process potentially coalesced packets.
            let read = match conn.recv(&mut buf[..len], recv_info) {
                Ok(v) => v,

                Err(e) => {
                    error!("recv failed: {e:?}");
                    continue 'read;
                },
            };

            debug!("processed {read} bytes");
        }

        debug!("done reading");

        if conn.is_closed() {
            info!("connection closed, {:?}", conn.stats());
            break;
        }

        // Create a new NWEP connection once the QUIC connection is established.
        if conn.is_established() && nwep_conn.is_none() {
            nwep_conn = Some(
                quiche::h3::Connection::with_transport(&mut conn, &nwep_config)
                .expect("Unable to create NWEP connection, check the server's uni stream limit and window size"),
            );
        }

        // Send NWEP requests once the QUIC connection is established, and until
        // all requests have been sent.
        if let Some(nwep_conn_ref) = &mut nwep_conn {
            if !req_sent {
                info!("sending NWEP request {req:?}");

                nwep_conn_ref.send_request(&mut conn, &req, true).unwrap();

                req_sent = true;
            }
        }

        if let Some(nwep_conn) = &mut nwep_conn {
            // Process NWEP events.
            loop {
                match nwep_conn.poll(&mut conn) {
                    Ok((stream_id, quiche::h3::Event::Headers { list, .. })) => {
                        let hdrs = hdrs_to_strings(&list);

                        // Just print the status token, nothing else
                        for hdr in &list {
                            if hdr.name() == b":status" {
                                let status = String::from_utf8_lossy(hdr.value());
                                println!("{}", status);
                                break;
                            }
                        }

                        info!(
                            "got response headers {:?} on stream id {}",
                            hdrs,
                            stream_id
                        );
                    },

                    Ok((stream_id, quiche::h3::Event::Data)) => {
                        while let Ok(read) =
                            nwep_conn.recv_body(&mut conn, stream_id, &mut buf)
                        {
                            debug!(
                                "got {read} bytes of response data on stream {stream_id}"
                            );

                            print!("{}", unsafe {
                                std::str::from_utf8_unchecked(&buf[..read])
                            });
                        }
                    },

                    Ok((_stream_id, quiche::h3::Event::Finished)) => {
                        info!(
                            "response received in {:?}, closing...",
                            req_start.elapsed()
                        );

                        conn.close(true, 0x100, b"kthxbye").unwrap();
                    },

                    Ok((_stream_id, quiche::h3::Event::Reset(e))) => {
                        error!("request was reset by peer with {e}, closing...");

                        conn.close(true, 0x100, b"kthxbye").unwrap();
                    },

                    Ok((_, quiche::h3::Event::PriorityUpdate)) => unreachable!(),

                    Ok((goaway_id, quiche::h3::Event::GoAway)) => {
                        info!("GOAWAY id={goaway_id}");
                    },

                    Err(quiche::h3::Error::Done) => {
                        break;
                    },

                    Err(e) => {
                        error!("NWEP processing failed: {e:?}");

                        break;
                    },
                }
            }
        }

        // Generate outgoing QUIC packets and send them on the UDP socket, until
        // quiche reports that there are no more packets to be sent.
        loop {
            let (write, send_info) = match conn.send(&mut out) {
                Ok(v) => v,

                Err(quiche::Error::Done) => {
                    debug!("done writing");
                    break;
                },

                Err(e) => {
                    error!("send failed: {e:?}");

                    conn.close(false, 0x1, b"fail").ok();
                    break;
                },
            };

            if let Err(e) = socket.send_to(&out[..write], send_info.to) {
                if e.kind() == std::io::ErrorKind::WouldBlock {
                    debug!("send() would block");
                    break;
                }

                panic!("send() failed: {e:?}");
            }

            debug!("written {write}");
        }

        if conn.is_closed() {
            info!("connection closed, {:?}", conn.stats());
            break;
        }
    }
}

fn hex_dump(buf: &[u8]) -> String {
    let vec: Vec<String> = buf.iter().map(|b| format!("{b:02x}")).collect();

    vec.join("")
}

pub fn hdrs_to_strings(hdrs: &[quiche::h3::Header]) -> Vec<(String, String)> {
    hdrs.iter()
        .map(|h| {
            let name = String::from_utf8_lossy(h.name()).to_string();
            let value = String::from_utf8_lossy(h.value()).to_string();

            (name, value)
        })
        .collect()
}
