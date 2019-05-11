import base64
import sys
from umbral import pre, keys

alice_public_key = keys.UmbralPublicKey.from_bytes(base64.b64decode(sys.argv[1]))
text_to_encrypt = base64.b64decode(sys.argv[2]).decode('utf-8').encode()
ciphertext, capsule = pre.encrypt(alice_public_key, text_to_encrypt)

print(base64.b64encode(ciphertext), base64.b64encode(capsule.to_bytes()))
