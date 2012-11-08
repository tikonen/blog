{-# LANGUAGE ScopedTypeVariables #-}

module Hex (
  hexToByteString,
  ) where


import Data.Char (ord, chr, toUpper)
import qualified Data.ByteString as B
import Data.Convertible
import Data.Bits (shift, (.|.), (.&.))
import GHC.Word (Word8)

byteStringToHex :: B.ByteString -> String
byteStringToHex bs = decodeBS . B.unpack $ bs
  where
    decodeBS :: [Word8] -> String
    decodeBS [] = []
    decodeBS (b:bs) = [ encodeNibble hn, encodeNibble ln ] ++ decodeBS bs
      where hn = fromIntegral (shift b (-4))
            ln = fromIntegral (b .&. 0x0F)
            encodeNibble n
              | n >= 0 && n <= 9 = chr (n + o0)
              | otherwise = chr (n + oA - 10)
              where o0 = ord '0'
                    oA = ord 'A'

hexToByteString :: String -> B.ByteString
hexToByteString s
  | null s = B.empty
  | otherwise = B.pack . hexToWord8 $ s
  where
    hexToWord8 :: String -> [Word8]
    hexToWord8 [] = []
    hexToWord8 [x] = error "Invalid hex stream"
    hexToWord8 (x:y:xs) = [ hn .|. ln ] ++ hexToWord8 xs
      where
        hn = (shift (decodeNibble x) 4)
        ln = decodeNibble y
        decodeNibble c
          | o >= oA && o <= oF = convert (o - oA + 10) :: Word8
          | o >= o0 && o <= o9 = convert (o - o0) :: Word8
          | otherwise = error $ "Invalid hex: " ++ [c]
          where o = ord . toUpper $ c
                oA = ord 'A'
                oF = ord 'F'
                o0 = ord '0'
                o9 = ord '9'
