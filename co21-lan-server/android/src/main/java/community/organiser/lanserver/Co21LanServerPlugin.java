package community.organiser.lanserver;

import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import fi.iki.elonen.NanoHTTPD;

@CapacitorPlugin(name = "Co21LanServer")
public class Co21LanServerPlugin extends Plugin {

  private static final String TAG = "Co21LanServer";
  static final int PORT = 47321;
  static final String API_PREFIX = "/co21-lan/v1";
  private static final long PENDING_TTL_MS = 5 * 60 * 1000;
  private static final long ACCEPTED_CACHE_MS = 10 * 60 * 1000;
  private static final long SYNC_BRIDGE_TIMEOUT_MS = 30_000;

  private LanNanoServer httpServer;
  private Identity identity;
  private final Set<String> trustedDeviceIds = new HashSet<>();
  private final Set<String> trustedHostKeys = new HashSet<>();
  private final Map<String, PendingPair> pendings = new ConcurrentHashMap<>();
  private final Map<String, AcceptedPair> acceptedByToken = new ConcurrentHashMap<>();
  private final Map<String, SyncBridgePending> syncBridgePending = new ConcurrentHashMap<>();

  private static class Identity {
    String deviceId;
    String deviceName;
    String appVersion;
  }

  private static class PendingPair {
    String token;
    String remoteDeviceId;
    String remoteName;
    String remoteAppVersion;
    String remoteAddress;
    List<String> remoteLanAddresses;
    long createdAt;
    String status; // pending | accepted | rejected
  }

  private static class AcceptedPair {
    final JSONObject peer;
    final long acceptedAt;

    AcceptedPair(JSONObject peer, long acceptedAt) {
      this.peer = peer;
      this.acceptedAt = acceptedAt;
    }
  }

  static class SyncBridgePending {
    final CountDownLatch latch = new CountDownLatch(1);
    volatile String responseJson;
  }

  @PluginMethod
  public void startServer(PluginCall call) {
    String deviceId = call.getString("deviceId", "").trim();
    String deviceName = call.getString("deviceName", "Device").trim();
    String appVersion = call.getString("appVersion", "").trim();
    if (deviceId.isEmpty()) {
      call.reject("missing_deviceId");
      return;
    }
    stopServerInternal();
    identity = new Identity();
    identity.deviceId = deviceId;
    identity.deviceName = deviceName.isEmpty() ? "Device" : deviceName;
    identity.appVersion = appVersion;

    try {
      httpServer = new LanNanoServer();
      httpServer.start(NanoHTTPD.SOCKET_READ_TIMEOUT, false);
      JSObject ret = new JSObject();
      ret.put("ok", true);
      ret.put("port", PORT);
      JSArray addrs = new JSArray();
      for (String a : getLanIPv4Addresses()) {
        addrs.put(a);
      }
      ret.put("addresses", addrs);
      call.resolve(ret);
      Log.i(TAG, "LAN server listening on " + PORT);
    } catch (IOException e) {
      identity = null;
      httpServer = null;
      JSObject ret = new JSObject();
      ret.put("ok", false);
      ret.put("error", e.getMessage() != null ? e.getMessage() : "start_failed");
      call.resolve(ret);
    }
  }

  @PluginMethod
  public void stopServer(PluginCall call) {
    stopServerInternal();
    JSObject ret = new JSObject();
    ret.put("ok", true);
    call.resolve(ret);
  }

  @PluginMethod
  public void status(PluginCall call) {
    JSObject ret = new JSObject();
    ret.put("listening", httpServer != null && httpServer.isAlive());
    ret.put("port", PORT);
    JSArray addrs = new JSArray();
    if (httpServer != null) {
      for (String a : getLanIPv4Addresses()) {
        addrs.put(a);
      }
    }
    ret.put("addresses", addrs);
    call.resolve(ret);
  }

  @PluginMethod
  public void setTrustedContractDevices(PluginCall call) {
    trustedDeviceIds.clear();
    trustedHostKeys.clear();
    JSArray peers = call.getArray("peers");
    int count = 0;
    if (peers != null) {
      for (int i = 0; i < peers.length(); i++) {
        try {
          JSObject p = JSObject.fromJSONObject(peers.getJSONObject(i));
          String id = p.getString("deviceId", "").trim().toLowerCase();
          if (!id.isEmpty()) {
            trustedDeviceIds.add(id);
            count++;
          }
          String host = p.getString("lanHost", "").trim();
          for (String k : lanHostMatchKeys(host)) {
            trustedHostKeys.add(k);
          }
        } catch (JSONException e) {
          Log.w(TAG, "skip trusted peer", e);
        }
      }
    }
    JSObject ret = new JSObject();
    ret.put("ok", true);
    ret.put("count", count);
    call.resolve(ret);
  }

  @PluginMethod
  public void resolvePair(PluginCall call) {
    String token = normalizeToken(call.getString("token", ""));
    boolean accept = Boolean.TRUE.equals(call.getBoolean("accept", false));
    PendingPair p = pendings.get(token);
    if (p == null || !"pending".equals(p.status)) {
      JSObject ret = new JSObject();
      ret.put("ok", false);
      call.resolve(ret);
      return;
    }
    p.status = accept ? "accepted" : "rejected";
    if (accept) {
      cacheAcceptedPair(token);
    } else {
      acceptedByToken.remove(token);
    }
    JSObject ret = new JSObject();
    ret.put("ok", true);
    call.resolve(ret);
  }

  @PluginMethod
  public void resolveSyncExchange(PluginCall call) {
    String requestId = call.getString("requestId", "").trim();
    String responseJson = call.getString("responseJson", "");
    SyncBridgePending pending = syncBridgePending.remove(requestId);
    if (pending != null) {
      pending.responseJson = responseJson != null ? responseJson : "{}";
      pending.latch.countDown();
    }
    JSObject ret = new JSObject();
    ret.put("ok", true);
    call.resolve(ret);
  }

  private void stopServerInternal() {
    if (httpServer != null) {
      try {
        httpServer.stop();
      } catch (Exception e) {
        Log.w(TAG, "stop server", e);
      }
      httpServer = null;
    }
    identity = null;
    pendings.clear();
    acceptedByToken.clear();
    for (SyncBridgePending p : syncBridgePending.values()) {
      p.responseJson = "{\"ok\":false,\"error\":\"server_stopped\"}";
      p.latch.countDown();
    }
    syncBridgePending.clear();
  }

  private class LanNanoServer extends NanoHTTPD {

    LanNanoServer() {
      super(PORT);
    }

    @Override
    public Response serve(IHTTPSession session) {
      try {
        if (session.getMethod() == Method.OPTIONS) {
          return cors(newFixedLengthResponse(Response.Status.NO_CONTENT, MIME_PLAINTEXT, ""));
        }

        String uri = session.getUri();
        if (uri == null) {
          return jsonResponse(400, errorBody("bad_request"));
        }

        String path = normalizeApiPath(uri.split("\\?")[0]);
        Method method = session.getMethod();
        String remoteAddr = normalizeClientIp(session.getRemoteIpAddress());

        if (method == Method.GET && (path.equals("/") || path.equals(API_PREFIX))) {
          try {
            JSONObject body = new JSONObject();
            body.put("service", "CO21 LAN");
            body.put("info", API_PREFIX + "/info");
            body.put("port", PORT);
            return jsonResponse(200, body);
          } catch (JSONException e) {
            return jsonResponse(500, errorBody("internal"));
          }
        }

        if (method == Method.GET && path.equals(API_PREFIX + "/info")) {
          return handleInfo();
        }

        if (method == Method.POST && path.equals(API_PREFIX + "/pair/request")) {
          return handlePairRequest(session, remoteAddr);
        }

        if (method == Method.POST && path.equals(API_PREFIX + "/pair/notify-accepted")) {
          return handleNotifyAccepted(session, remoteAddr);
        }

        if (method == Method.GET && path.startsWith(API_PREFIX + "/pair/status/")) {
          String token = path.substring((API_PREFIX + "/pair/status/").length());
          return handlePairStatus(token);
        }

        if (method == Method.POST && path.equals(API_PREFIX + "/sync/contract/propose")) {
          return handleContractPropose(session, remoteAddr);
        }

        if (method == Method.POST && path.equals(API_PREFIX + "/sync/contract/reject")) {
          return handleContractReject(session, remoteAddr);
        }

        if (method == Method.POST && path.equals(API_PREFIX + "/sync/exchange")) {
          return handleSyncExchange(session, remoteAddr);
        }

        return jsonResponse(404, errorBody("not_found"));
      } catch (Exception e) {
        Log.e(TAG, "serve error", e);
        return jsonResponse(500, errorBody("internal"));
      }
    }
  }

  private NanoHTTPD.Response handleInfo() {
    if (identity == null) {
      return jsonResponse(503, errorBody("not_ready"));
    }
    try {
      JSONObject body = new JSONObject();
      body.put("deviceId", identity.deviceId);
      body.put("deviceName", identity.deviceName);
      body.put("appVersion", identity.appVersion);
      return jsonResponse(200, body);
    } catch (JSONException e) {
      return jsonResponse(500, errorBody("internal"));
    }
  }

  private NanoHTTPD.Response handlePairRequest(NanoHTTPD.IHTTPSession session, String remoteAddr) {
    if (identity == null) {
      return jsonResponse(503, errorBody("server_not_ready"));
    }
    try {
      String raw = readBody(session);
      JSONObject parsed = new JSONObject(raw != null && !raw.isEmpty() ? raw : "{}");
      String remoteDeviceId = parsed.optString("deviceId", "").trim();
      if (remoteDeviceId.isEmpty()) {
        return jsonResponse(400, errorBody("missing_deviceId"));
      }
      registerLanPeerConnection(remoteDeviceId, remoteAddr);
      String remoteName = parsed.optString("deviceName", "Unknown device");
      String remoteAppVersion = parsed.optString("appVersion", "");
      List<String> bodyAddrs = parseLanAddresses(parsed.opt("lanReachableAddresses"));
      List<String> remoteLanAddresses = new ArrayList<>(bodyAddrs);
      if (isUsableHost(remoteAddr)) {
        remoteLanAddresses.add(remoteAddr);
      }

      String token = UUID.randomUUID().toString();
      PendingPair pending = new PendingPair();
      pending.token = token;
      pending.remoteDeviceId = remoteDeviceId;
      pending.remoteName = remoteName;
      pending.remoteAppVersion = remoteAppVersion;
      pending.remoteAddress = remoteAddr;
      pending.remoteLanAddresses = remoteLanAddresses;
      pending.createdAt = System.currentTimeMillis();
      pending.status = "pending";
      pendings.put(token, pending);

      JSObject detail = new JSObject();
      detail.put("token", token);
      detail.put("remoteDeviceId", remoteDeviceId);
      detail.put("remoteName", remoteName);
      if (!remoteAppVersion.isEmpty()) {
        detail.put("remoteAppVersion", remoteAppVersion);
      }
      if (!remoteAddr.isEmpty()) {
        detail.put("remoteAddress", remoteAddr);
      }
      if (!remoteLanAddresses.isEmpty()) {
        JSArray arr = new JSArray();
        for (String a : remoteLanAddresses) {
          arr.put(a);
        }
        detail.put("remoteLanAddresses", arr);
      }
      notifyListeners("pairingPending", detail);

      JSONObject res = new JSONObject();
      res.put("token", token);
      res.put("statusUrl", API_PREFIX + "/pair/status/" + token);
      return jsonResponse(200, res);
    } catch (JSONException e) {
      return jsonResponse(400, errorBody("invalid_json"));
    } catch (Exception e) {
      return jsonResponse(400, errorBody("bad_body"));
    }
  }

  private NanoHTTPD.Response handleNotifyAccepted(NanoHTTPD.IHTTPSession session, String remoteAddr) {
    if (identity == null) {
      return jsonResponse(503, errorBody("server_not_ready"));
    }
    try {
      String raw = readBody(session);
      JSONObject parsed = new JSONObject(raw != null && !raw.isEmpty() ? raw : "{}");
      String deviceId = parsed.optString("deviceId", "").trim();
      if (deviceId.isEmpty()) {
        return jsonResponse(400, errorBody("missing_deviceId"));
      }
      String deviceName = parsed.optString("deviceName", "Unknown device");
      List<String> bodyAddrs = parseLanAddresses(parsed.opt("lanReachableAddresses"));
      String lanHost = pickReachableHost(bodyAddrs, remoteAddr);

      JSObject detail = new JSObject();
      detail.put("id", deviceId);
      detail.put("deviceId", deviceId);
      detail.put("name", deviceName);
      detail.put("deviceName", deviceName);
      detail.put("type", "LAN");
      if (!lanHost.isEmpty()) {
        detail.put("lanHost", lanHost);
      }
      String ver = parsed.optString("appVersion", "");
      if (!ver.isEmpty()) {
        detail.put("appVersion", ver);
      }
      if (!bodyAddrs.isEmpty()) {
        JSArray arr = new JSArray();
        for (String a : bodyAddrs) {
          arr.put(a);
        }
        detail.put("lanReachableAddresses", arr);
      }
      notifyListeners("pairingComplete", detail);

      JSONObject ok = new JSONObject();
      ok.put("ok", true);
      return jsonResponse(200, ok);
    } catch (JSONException e) {
      return jsonResponse(400, errorBody("invalid_json"));
    } catch (Exception e) {
      return jsonResponse(400, errorBody("bad_body"));
    }
  }

  private NanoHTTPD.Response handlePairStatus(String tokenRaw) {
    String token = normalizeToken(tokenRaw);
    AcceptedPair cached = acceptedByToken.get(token);
    if (cached != null) {
      try {
        JSONObject res = new JSONObject();
        res.put("status", "accepted");
        res.put("peer", cached.peer);
        return jsonResponse(200, res);
      } catch (JSONException e) {
        return jsonResponse(200, unknownStatus());
      }
    }
    PendingPair p = pendings.get(token);
    if (p == null) {
      return jsonResponse(200, unknownStatus());
    }
    try {
      if ("pending".equals(p.status)) {
        JSONObject res = new JSONObject();
        res.put("status", "pending");
        return jsonResponse(200, res);
      }
      if ("rejected".equals(p.status)) {
        pendings.remove(token);
        JSONObject res = new JSONObject();
        res.put("status", "rejected");
        return jsonResponse(200, res);
      }
      JSONObject peer = buildAcceptorPeer();
      if (peer == null) {
        return jsonResponse(200, unknownStatus());
      }
      acceptedByToken.put(token, new AcceptedPair(peer, System.currentTimeMillis()));
      JSONObject res = new JSONObject();
      res.put("status", "accepted");
      res.put("peer", peer);
      return jsonResponse(200, res);
    } catch (JSONException e) {
      return jsonResponse(200, unknownStatus());
    }
  }

  private NanoHTTPD.Response handleContractPropose(NanoHTTPD.IHTTPSession session, String remoteAddr) {
    try {
      String raw = readBody(session);
      JSONObject parsed = new JSONObject(raw != null && !raw.isEmpty() ? raw : "{}");
      String proposerDeviceId = parsed.optString("proposerDeviceId", "").trim();
      if (!parsed.has("snapshot") || proposerDeviceId.isEmpty()) {
        return jsonResponse(400, errorBody("invalid_contract"));
      }
      registerLanPeerConnection(proposerDeviceId, remoteAddr);
      if (!isTrusted(proposerDeviceId, remoteAddr)) {
        return jsonResponse(403, errorBody("proposer_not_registered"));
      }
      JSObject detail = JSObject.fromJSONObject(parsed);
      detail.put("proposerLanHost", remoteAddr);
      notifyListeners("syncContractIncoming", detail);
      JSONObject ok = new JSONObject();
      ok.put("ok", true);
      return jsonResponse(200, ok);
    } catch (JSONException e) {
      return jsonResponse(400, errorBody("invalid_json"));
    } catch (Exception e) {
      return jsonResponse(400, errorBody("bad_body"));
    }
  }

  private NanoHTTPD.Response handleContractReject(NanoHTTPD.IHTTPSession session, String remoteAddr) {
    try {
      String raw = readBody(session);
      JSONObject parsed = new JSONObject(raw != null && !raw.isEmpty() ? raw : "{}");
      String rejectorDeviceId = parsed.optString("rejectorDeviceId", "").trim();
      if (rejectorDeviceId.isEmpty()) {
        return jsonResponse(400, errorBody("invalid_reject"));
      }
      if (!isTrusted(rejectorDeviceId, remoteAddr)) {
        return jsonResponse(403, errorBody("rejector_not_registered"));
      }
      JSObject detail = JSObject.fromJSONObject(parsed);
      notifyListeners("syncContractRejected", detail);
      JSONObject ok = new JSONObject();
      ok.put("ok", true);
      return jsonResponse(200, ok);
    } catch (JSONException e) {
      return jsonResponse(400, errorBody("invalid_json"));
    } catch (Exception e) {
      return jsonResponse(400, errorBody("bad_body"));
    }
  }

  private NanoHTTPD.Response handleSyncExchange(NanoHTTPD.IHTTPSession session, String remoteAddr) {
    try {
      String raw = readBody(session);
      JSONObject parsed = new JSONObject(raw != null && !raw.isEmpty() ? raw : "{}");
      String deviceId = parsed.optString("deviceId", "").trim();
      if (deviceId.isEmpty()) {
        return jsonResponse(400, errorBody("invalid_sync_request"));
      }
      registerLanPeerConnection(deviceId, remoteAddr);
      if (!isTrusted(deviceId, remoteAddr)) {
        return jsonResponse(403, errorBody("device_not_registered"));
      }

      String requestId = UUID.randomUUID().toString();
      SyncBridgePending pending = new SyncBridgePending();
      syncBridgePending.put(requestId, pending);

      JSObject event = new JSObject();
      event.put("requestId", requestId);
      event.put("body", parsed.toString());
      notifyListeners("syncExchangeRequest", event);

      boolean done = pending.latch.await(SYNC_BRIDGE_TIMEOUT_MS, TimeUnit.MILLISECONDS);
      syncBridgePending.remove(requestId);
      String responseJson = pending.responseJson;
      if (!done || responseJson == null || responseJson.isEmpty()) {
        return jsonResponse(503, errorBody("bridge_timeout"));
      }

      JSONObject response = new JSONObject(responseJson);
      int code = response.optBoolean("ok", false) ? 200 : 400;
      return jsonResponse(code, response);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      return jsonResponse(503, errorBody("bridge_interrupted"));
    } catch (JSONException e) {
      return jsonResponse(400, errorBody("invalid_json"));
    } catch (Exception e) {
      return jsonResponse(500, errorBody("bridge_error"));
    }
  }

  private void registerLanPeerConnection(String deviceId, String remoteAddr) {
    String id = deviceId.trim().toLowerCase();
    if (!id.isEmpty()) {
      trustedDeviceIds.add(id);
    }
    String rip = normalizeClientIp(remoteAddr).toLowerCase();
    if (!rip.isEmpty()) {
      trustedHostKeys.add(rip);
    }
  }

  private boolean isTrusted(String deviceId, String remoteAddr) {
    if (trustedDeviceIds.isEmpty() && trustedHostKeys.isEmpty()) {
      return true;
    }
    String id = deviceId.trim().toLowerCase();
    if (!id.isEmpty() && trustedDeviceIds.contains(id)) {
      return true;
    }
    String rip = normalizeClientIp(remoteAddr).toLowerCase();
    return !rip.isEmpty() && trustedHostKeys.contains(rip);
  }

  private JSONObject buildAcceptorPeer() {
    if (identity == null) {
      return null;
    }
    try {
      JSONObject peer = new JSONObject();
      peer.put("deviceId", identity.deviceId);
      peer.put("deviceName", identity.deviceName);
      peer.put("appVersion", identity.appVersion);
      JSONArray addrs = new JSONArray();
      for (String a : getLanIPv4Addresses()) {
        addrs.put(a);
      }
      peer.put("lanAddresses", addrs);
      return peer;
    } catch (JSONException e) {
      return null;
    }
  }

  private void cacheAcceptedPair(String token) {
    JSONObject peer = buildAcceptorPeer();
    if (peer != null) {
      acceptedByToken.put(token, new AcceptedPair(peer, System.currentTimeMillis()));
    }
  }

  private static JSONObject unknownStatus() {
    JSONObject res = new JSONObject();
    try {
      res.put("status", "unknown");
    } catch (JSONException e) {
      Log.w(TAG, "unknownStatus", e);
    }
    return res;
  }

  private static JSONObject errorBody(String code) {
    JSONObject o = new JSONObject();
    try {
      o.put("error", code);
    } catch (JSONException e) {
      Log.w(TAG, "errorBody", e);
    }
    return o;
  }

  private NanoHTTPD.Response jsonResponse(int code, JSONObject body) {
    String json = body != null ? body.toString() : "{}";
    NanoHTTPD.Response r =
      NanoHTTPD.newFixedLengthResponse(statusForCode(code), "application/json; charset=utf-8", json);
    return cors(r);
  }

  private static NanoHTTPD.Response.Status statusForCode(int code) {
    switch (code) {
      case 200:
        return NanoHTTPD.Response.Status.OK;
      case 204:
        return NanoHTTPD.Response.Status.NO_CONTENT;
      case 400:
        return NanoHTTPD.Response.Status.BAD_REQUEST;
      case 403:
        return NanoHTTPD.Response.Status.FORBIDDEN;
      case 404:
        return NanoHTTPD.Response.Status.NOT_FOUND;
      case 503:
        return NanoHTTPD.Response.Status.SERVICE_UNAVAILABLE;
      default:
        return NanoHTTPD.Response.Status.INTERNAL_ERROR;
    }
  }

  private static NanoHTTPD.Response cors(NanoHTTPD.Response response) {
    response.addHeader("Access-Control-Allow-Origin", "*");
    response.addHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.addHeader("Access-Control-Allow-Headers", "Content-Type");
    return response;
  }

  private static String readBody(NanoHTTPD.IHTTPSession session)
    throws IOException, NanoHTTPD.ResponseException {
    Map<String, String> files = new HashMap<>();
    session.parseBody(files);
    String body = files.get("postData");
    if (body != null) {
      return body;
    }
    return session.getQueryParameterString();
  }

  static String normalizeApiPath(String raw) {
    if (raw == null || raw.isEmpty()) {
      return "/";
    }
    String p = raw.trim();
    if (p.length() > 1 && p.endsWith("/")) {
      p = p.substring(0, p.length() - 1);
    }
    if (p.equals("/info")) {
      return API_PREFIX + "/info";
    }
    return p;
  }

  static String normalizeClientIp(String raw) {
    if (raw == null) {
      return "";
    }
    String s = raw.trim();
    if (s.startsWith("::ffff:")) {
      s = s.substring(7);
    }
    int slash = s.indexOf('/');
    if (slash > 0) {
      s = s.substring(0, slash);
    }
    return s;
  }

  static String normalizeToken(String raw) {
    try {
      return java.net.URLDecoder.decode(String.valueOf(raw).trim(), "UTF-8");
    } catch (Exception e) {
      return String.valueOf(raw).trim();
    }
  }

  static boolean isUsableHost(String host) {
    if (host == null || host.isEmpty()) {
      return false;
    }
    String h = host.toLowerCase();
    if ("localhost".equals(h) || "::1".equals(h) || "0.0.0.0".equals(h)) {
      return false;
    }
    return !h.startsWith("127.");
  }

  static boolean isPrivateLanIPv4(String ip) {
    String[] parts = ip.split("\\.");
    if (parts.length != 4) {
      return false;
    }
    try {
      int a = Integer.parseInt(parts[0]);
      int b = Integer.parseInt(parts[1]);
      if (a == 10) {
        return true;
      }
      if (a == 172 && b >= 16 && b <= 31) {
        return true;
      }
      return a == 192 && b == 168;
    } catch (NumberFormatException e) {
      return false;
    }
  }

  static List<String> getLanIPv4Addresses() {
    List<String> out = new ArrayList<>();
    try {
      Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
      while (interfaces.hasMoreElements()) {
        NetworkInterface ni = interfaces.nextElement();
        if (!ni.isUp() || ni.isLoopback()) {
          continue;
        }
        Enumeration<InetAddress> addrs = ni.getInetAddresses();
        while (addrs.hasMoreElements()) {
          InetAddress addr = addrs.nextElement();
          if (addr instanceof Inet4Address && !addr.isLoopbackAddress()) {
            String ip = addr.getHostAddress();
            if (ip != null && isPrivateLanIPv4(ip)) {
              out.add(ip);
            }
          }
        }
      }
    } catch (Exception e) {
      Log.w(TAG, "getLanIPv4Addresses", e);
    }
    Collections.sort(out, (a, b) -> {
      int sa = scoreLanIp(a);
      int sb = scoreLanIp(b);
      if (sa != sb) {
        return Integer.compare(sa, sb);
      }
      return a.compareTo(b);
    });
    List<String> uniq = new ArrayList<>();
    for (String ip : out) {
      if (!uniq.contains(ip)) {
        uniq.add(ip);
      }
    }
    return uniq;
  }

  private static int scoreLanIp(String ip) {
    if (!isPrivateLanIPv4(ip)) {
      return 100;
    }
    if (ip.startsWith("192.168.")) {
      return 0;
    }
    if (ip.startsWith("10.")) {
      return 10;
    }
    return 20;
  }

  static List<String> parseLanAddresses(Object raw) {
    List<String> out = new ArrayList<>();
    if (raw instanceof JSONArray) {
      JSONArray arr = (JSONArray) raw;
      for (int i = 0; i < arr.length(); i++) {
        String s = arr.optString(i, "").trim();
        if (isUsableHost(s)) {
          out.add(s);
        }
      }
    }
    return out;
  }

  static String pickReachableHost(List<String> candidates, String fallback) {
    for (String c : candidates) {
      if (isUsableHost(c)) {
        return c;
      }
    }
    if (isUsableHost(fallback)) {
      return fallback;
    }
    return "";
  }

  static List<String> lanHostMatchKeys(String host) {
    List<String> keys = new ArrayList<>();
    if (host == null || host.isEmpty()) {
      return keys;
    }
    String raw = host.trim();
    int colon = raw.indexOf(':');
    String hostPart = colon > 0 ? raw.substring(0, colon) : raw;
    int slash = hostPart.indexOf('/');
    if (slash > 0) {
      hostPart = hostPart.substring(0, slash);
    }
    if (!hostPart.isEmpty()) {
      keys.add(hostPart.toLowerCase());
    }
    return keys;
  }
}
