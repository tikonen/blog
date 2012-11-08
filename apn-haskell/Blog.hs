-- Blog.hs
import Hex
import Text.JSON as JSON
import qualified Data.ByteString as B
import qualified Data.ByteString.UTF8 as BU
import qualified Data.ByteString.Lazy as BL
import Data.Binary.Put
import GHC.Word (Word32, Word16)
import Data.Convertible (convert)

import Data.Time.Clock.POSIX (getPOSIXTime)

import Network.Socket
import Network.BSD (getHostByName, hostAddress, getProtocolNumber)
import OpenSSL
import OpenSSL.Session as SSL (
  context,
  contextSetPrivateKeyFile,
  contextSetCertificateFile,
  contextSetCiphers,
  contextSetDefaultCiphers,
  contextSetVerificationMode,
  contextSetCAFile,
  connection,
  connect,
  shutdown,
  write,
  read,
  SSL,
  VerificationMode(..),
  ShutdownType(..)
  )


main = withOpenSSL $ do
  -- Prepare SSL context
  ssl <- context
  contextSetPrivateKeyFile ssl "key-noenc.pem"
  contextSetCertificateFile ssl "cert.pem"
  contextSetDefaultCiphers ssl
  contextSetVerificationMode ssl SSL.VerifyNone

  -- Open socket
  proto <- (getProtocolNumber "tcp")
  he <- getHostByName "localhost"
        -- he <- getHostByName "gateway.sandbox.push.apple.com"
  sock <- socket AF_INET Stream proto
  Network.Socket.connect sock (SockAddrInet 2295 (hostAddress he))

  -- Promoto socket to SSL stream
  sslsocket <- connection ssl sock
  SSL.connect sslsocket  -- Handshake

  expiration <- getExpiryTime
  -- we send pdu here
  let token = "6b4628de9317c80edd1c791640b58fdfc46d21d0d2d1351687239c44d8e30ab1"
      message = "Hello World"
      btoken = hexToByteString token
      payload = BU.fromString . JSON.encode . getJSONWithMessage $ message
      lpdu = runPut $ buildPDU btoken payload expiration
      pdu = toStrict lpdu
    in do
    SSL.write sslsocket pdu
    SSL.shutdown sslsocket Unidirectional -- Close gracefully
  where
    toStrict = B.concat . BL.toChunks



buildPDU :: B.ByteString -> BU.ByteString -> Word32 -> Put
buildPDU token payload expiry
  | (B.length token) /= 32 = fail "Invalid token"
  | (B.length payload > 255) = fail "Too long payload"
  | otherwise = do
    putWord8 1
    putWord32be 1
    putWord32be expiry
    putWord16be ((convert $ B.length token) :: Word16)
    putByteString token
    putWord16be ((convert $ B.length payload) :: Word16)
    putByteString payload


getJSONWithMessage :: String -> JSObject (JSValue)
getJSONWithMessage msg =
  let jmsg = JSString (toJSString msg) in
  toJSObject [("aps",
               JSObject (toJSObject [("alert", jmsg)]))]

getExpiryTime :: IO (Word32)
getExpiryTime = do
  pt <- getPOSIXTime
  -- One hour expiry time
  return ( (round pt + 60*60):: Word32)
