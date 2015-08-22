# This is a basic VCL configuration file for varnish.  See the vcl(7)
# man page for details on VCL syntax and semantics.
# 
# Default backend definition.  Set this to point to your content
# server.
# 
backend default {
    .host = "127.0.0.1";
    .port = "8080";
}


acl purge {
        "localhost";
        "10.0.0.0"/8;
        "192.168.0.0"/16;
        "172.16.0.0"/12;
}

sub vcl_backend_response {  
    # TTL 1 min
    set beresp.ttl = 1m;
    if (bereq.url ~ "\.(avi|mp4|ogv|deb|tar|gz|rar||zip)$") {
        set beresp.do_stream = true;
        set beresp.ttl = 3m;
    }
}

sub vcl_recv {
    unset req.http.Cookie;
    if (req.method != "GET" && req.method != "HEAD"){   
        return (pass);
    }
    if (req.url ~ "^[^?]*\.(mp[34]|rar|tar|tgz|gz|wav|iso|img|dmg|mkv|ogv|avi|zip)(\?.*)?$") {
        unset req.http.Cookie;
        return (pipe);
    }
    if (req.http.Authorization) {
        # Not cacheable by default
        return (pass);
    }
        # Allow purging
    if (req.method == "PURGE") {
        if (!client.ip ~ purge) {
            # Not from an allowed IP? Then die with an error.
            return (synth(405, "This IP is not allowed to send PURGE requests."));
        }

        # If you got this stage (and didn't error out above), do a cache-lookup
        # That will force entry into vcl_hit() or vcl_miss() below and purge the actual cache
        return (hash);
    }
}


sub vcl_hit {
    # Allow purges
    if (req.method == "PURGE") {
        #
        # This is now handled in vcl_recv.
        #
        # purge;
        return (synth(200, "purged"));
    }

    return (deliver);
}

sub vcl_miss {
    # Allow purges
    if (req.method == "PURGE") {
        #
        # This is now handled in vcl_recv.
        #
        # purge;
        return (synth(200, "purged"));
    }

    return (fetch);
}


sub vcl_deliver {
    if (obj.hits > 0) {
        set resp.http.X-Cache = "cached";
    } else {
        set resp.http.X-Cache = "uncached";
    }

    unset resp.http.Server;
    unset resp.http.X-Varnish;
    unset resp.http.Via;
    unset resp.http.Link;

    return (deliver);
}