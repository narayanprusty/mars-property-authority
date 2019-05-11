from umbral import pre, keys
import base64

alice_private_key = keys.UmbralPrivateKey.gen_key()
print(base64.b64encode(alice_private_key.to_bytes()))
