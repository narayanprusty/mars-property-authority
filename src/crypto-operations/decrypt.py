import base64
import sys
from umbral import pre, keys

alice_private_key = keys.UmbralPrivateKey.from_bytes(base64.b64decode(sys.argv[1]))
alice_public_key = keys.UmbralPublicKey.from_bytes(base64.b64decode(sys.argv[2]))
capsule = pre.Capsule.from_bytes(base64.b64decode(sys.argv[3]), alice_private_key.params)
ciphertext = base64.b64decode(sys.argv[4])
cleartext = pre.decrypt(ciphertext, capsule, alice_private_key, alice_public_key)
print(cleartext)
